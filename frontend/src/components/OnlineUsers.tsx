import { useEffect, useState } from "react";
import echo from "../echo";

type OnlineUser = {
    [key: string]: string;
    ".id": string;
    name: string;
    address: string;
    uptime: string;
};

type OnlineUsersUpdatedEvent = {
    users: OnlineUser[];
};

export default function OnlineUsers() {
    const [users, setUsers] = useState<OnlineUser[]>([]);

    useEffect(() => {

        echo.channel("mikrotik.online-users")
            .listen(".online.users.updated", (e: OnlineUsersUpdatedEvent) => {
                console.log("Received users", e.users);
                setUsers(e.users);
            });

        return () => {
            echo.leave("mikrotik.online-users");
        };

    }, []);

    return (
        <div>
            <h3>Active Users</h3>

            <table>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>IP</th>
                        <th>Uptime</th>
                    </tr>
                </thead>

                <tbody>
                    {users.map((user) => (
                        <tr key={user[".id"]}>
                            <td>{user.name}</td>
                            <td>{user.address}</td>
                            <td>{user.uptime}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}