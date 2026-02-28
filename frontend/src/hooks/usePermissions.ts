import { useMemo } from "react";

type StoredUser = {
    isSuperAdmin?: boolean;
    role?: {
        permissions?: Array<string | { name?: string }>;
    };
} | null;

const AUTH_KEY = "easy-tech-auth";

export function usePermissions() {
    const currentUser = useMemo<StoredUser>(() => {
        try {
            const raw = localStorage.getItem(AUTH_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }, []);

    const userPermissions = useMemo(() => {
        if (!currentUser) return [] as string[];
        if (currentUser.isSuperAdmin) return ["*"];

        const rawPerms = (currentUser.role?.permissions || []) as Array<string | { name?: string }>;

        return rawPerms
            .map((perm) => (typeof perm === "string" ? perm : perm?.name))
            .filter((perm): perm is string => Boolean(perm));
    }, [currentUser]);

    const can = (permission: string) => {
        if (!currentUser) return false;
        if (currentUser.isSuperAdmin) return true;
        return userPermissions.includes(permission);
    };

    const canAny = (permissions: string[]) => {
        if (!currentUser) return false;
        if (currentUser.isSuperAdmin) return true;
        return permissions.some((permission) => userPermissions.includes(permission));
    };

    return {
        currentUser,
        userPermissions,
        can,
        canAny,
    };
}
