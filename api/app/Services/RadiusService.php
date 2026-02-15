<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Exception;

class RadiusService
{
    private $radiusConnection;

    public function __construct()
    {
        // Get RADIUS database connection
        $this->radiusConnection = DB::connection('radius');
    }

    /**
     * Authenticate user against RADIUS database
     * Queries the radcheck table for credentials
     */
    public function authenticate($username, $password)
    {
        try {
            // Query the radcheck table for User-Password attribute
            $userPassword = $this->radiusConnection->table('radcheck')
                ->where('username', $username)
                ->where('attribute', 'User-Password')
                ->first();

            if (!$userPassword) {
                return [
                    'success' => false,
                    'message' => 'User not found in RADIUS database',
                    'status' => 'Access-Reject',
                ];
            }

            // Convert to array for consistency
            $userPassword = (array) $userPassword;

            // Verify password using the value from radcheck
            $passwordMatch = $this->verifyPassword($password, $userPassword['value'], $userPassword['op'] ?? '==');

            if (!$passwordMatch) {
                return [
                    'success' => false,
                    'message' => 'Invalid password',
                    'status' => 'Access-Reject',
                ];
            }

            // Get user group information from radusergroup
            $userGroups = $this->getUserGroups($username);

            // Log successful authentication to radpostauth
            $this->logPostAuth($username, 'Accept');

            return [
                'success' => true,
                'message' => 'Authentication successful',
                'status' => 'Access-Accept',
                'username' => $username,
                'groups' => $userGroups,
            ];
        } catch (Exception $e) {
            return [
                'success' => false,
                'message' => 'RADIUS database error: ' . $e->getMessage(),
                'status' => 'Access-Reject',
            ];
        }
    }

    /**
     * Verify password against RADIUS encryption
     * Supports plain text and MD5 hashing
     */
    private function verifyPassword($plainPassword, $storedPassword, $attribute = 'User-Password')
    {
        // Check if it's plain text
        if ($storedPassword === $plainPassword) {
            return true;
        }

        // Check if it's MD5 hashed
        if (md5($plainPassword) === $storedPassword) {
            return true;
        }

        // Check if it uses {MD5} prefix (common in RADIUS)
        if ('{MD5}' . md5($plainPassword) === $storedPassword) {
            return true;
        }

        // Check if it uses crypt
        if ($this->verifyCrypt($plainPassword, $storedPassword)) {
            return true;
        }

        return false;
    }

    /**
     * Verify crypt-hashed passwords
     */
    private function verifyCrypt($plainPassword, $hashedPassword)
    {
        return password_verify($plainPassword, $hashedPassword) || 
               crypt($plainPassword, $hashedPassword) === $hashedPassword;
    }

    /**
     * Get user groups from radusergroup table
     */
    private function getUserGroups($username)
    {
        try {
            $groups = $this->radiusConnection->table('radusergroup')
                ->where('username', $username)
                ->orderBy('priority')
                ->get(['groupname', 'priority']);

            return array_map(function($g) { return (array) $g; }, $groups->toArray());
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Log successful authentication to radpostauth
     */
    private function logPostAuth($username, $reply)
    {
        try {
            $this->radiusConnection->table('radpostauth')->insert([
                'username' => $username,
                'pass' => $reply,
                'reply' => $reply,
                'calledstationid' => '',
                'callingstationid' => '',
                'accuuntstatustype' => $reply,
                'authdate' => now(),
            ]);
        } catch (Exception $e) {
            // Log fails silently
        }
    }

    /**
     * Get user check attributes from radcheck table
     */
    public function getUserAttributes($username)
    {
        try {
            $attributes = $this->radiusConnection->table('radcheck')
                ->where('username', $username)
                ->get(['id', 'username', 'attribute', 'op', 'value']);

            return $attributes->toArray();
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Get user reply attributes from radreply table
     */
    public function getUserReplyAttributes($username)
    {
        try {
            $attributes = $this->radiusConnection->table('radreply')
                ->where('username', $username)
                ->get(['id', 'username', 'attribute', 'op', 'value']);

            return $attributes->toArray();
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Get group reply attributes (speed limits, session timeouts, etc)
     */
    public function getGroupReplyAttributes($groupname)
    {
        try {
            $attributes = $this->radiusConnection->table('radgroupreply')
                ->where('groupname', $groupname)
                ->get(['id', 'groupname', 'attribute', 'op', 'value']);

            return $attributes->toArray();
        } catch (Exception $e) {
            return [];
        }
    }

    /**
     * Create RADIUS user with credentials in radcheck table
     */
    public function createUser($username, $password, $attributes = [])
    {
        try {
            // Insert User-Password check into radcheck table
            $this->radiusConnection->table('radcheck')->insert([
                'username' => $username,
                'attribute' => 'User-Password',
                'op' => ':=',
                'value' => $password, // In production, should be hashed
            ]);

            // Add check attributes if provided
            if (!empty($attributes['check'])) {
                foreach ($attributes['check'] as $attr) {
                    $this->radiusConnection->table('radcheck')->insert([
                        'username' => $username,
                        'attribute' => $attr['attribute'],
                        'op' => $attr['op'] ?? ':=',
                        'value' => $attr['value'],
                    ]);
                }
            }

            // Add reply attributes if provided
            if (!empty($attributes['reply'])) {
                foreach ($attributes['reply'] as $attr) {
                    $this->radiusConnection->table('radreply')->insert([
                        'username' => $username,
                        'attribute' => $attr['attribute'],
                        'op' => $attr['op'] ?? ':=',
                        'value' => $attr['value'],
                    ]);
                }
            }

            return ['success' => true, 'message' => 'User created successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error creating user: ' . $e->getMessage()];
        }
    }

    /**
     * Update RADIUS user password
     */
    public function updateUserPassword($username, $newPassword)
    {
        try {
            $this->radiusConnection->table('radcheck')
                ->where('username', $username)
                ->where('attribute', 'User-Password')
                ->update([
                    'value' => $newPassword,
                ]);

            return ['success' => true, 'message' => 'Password updated'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error updating password: ' . $e->getMessage()];
        }
    }

    /**
     * Assign user to group
     */
    public function assignUserToGroup($username, $groupname, $priority = 1)
    {
        try {
            // Check if already exists
            $existing = $this->radiusConnection->table('radusergroup')
                ->where('username', $username)
                ->where('groupname', $groupname)
                ->first();

            if ($existing) {
                return ['success' => false, 'message' => 'User already in group'];
            }

            $this->radiusConnection->table('radusergroup')->insert([
                'username' => $username,
                'groupname' => $groupname,
                'priority' => $priority,
            ]);

            return ['success' => true, 'message' => 'User assigned to group'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error assigning to group: ' . $e->getMessage()];
        }
    }

    /**
     * Remove user from group
     */
    public function removeUserFromGroup($username, $groupname)
    {
        try {
            $this->radiusConnection->table('radusergroup')
                ->where('username', $username)
                ->where('groupname', $groupname)
                ->delete();

            return ['success' => true, 'message' => 'User removed from group'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error removing from group: ' . $e->getMessage()];
        }
    }

    /**
     * Check if user exists
     */
    public function userExists($username)
    {
        try {
            $user = $this->radiusConnection->table('radcheck')
                ->where('username', $username)
                ->where('attribute', 'User-Password')
                ->exists();

            return $user;
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Delete RADIUS user completely
     */
    public function deleteUser($username)
    {
        try {
            // Delete from all RADIUS tables
            $this->radiusConnection->table('radcheck')
                ->where('username', $username)
                ->delete();

            $this->radiusConnection->table('radreply')
                ->where('username', $username)
                ->delete();

            $this->radiusConnection->table('radusergroup')
                ->where('username', $username)
                ->delete();

            return ['success' => true, 'message' => 'User deleted'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => 'Error deleting user: ' . $e->getMessage()];
        }
    }

    /**
     * Get RADIUS database connection
     */
    public function getConnection()
    {
        return $this->radiusConnection;
    }

}
