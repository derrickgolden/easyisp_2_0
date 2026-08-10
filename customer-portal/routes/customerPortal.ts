import { Router, Request, Response } from "express";
import pool from "../config/database";

const router = Router();

function unauthorized(res: Response) {
    return res.status(401).json({
        success: false,
        message: "Unauthorized"
    });
}

function portalAuth(
    req: Request,
    res: Response,
    next: Function
) {
    const auth = req.headers.authorization;

    const expected =
        `Bearer ${process.env.CUSTOMER_PORTAL_API_TOKEN}`;

    if (!auth || auth !== expected) {
        return unauthorized(res);
    }

    next();
}


/**
 * Identify a customer by the IP assigned
 * to their PPPoE session.
 */
router.get(
    "/customer/portal",
    portalAuth,
    async (req: Request, res: Response) => {

        try {

            const ip = String(req.query.ip || "");

            if (!ip) {
                return res.status(400).json({
                    success: false,
                    message: "IP address is required"
                });
            }

            /*
             * radacct contains the current PPPoE
             * session information.
             *
             * We use the most recent session for
             * this IP.
             */

            const [rows]: any = await pool.query(
                `
                SELECT
                    ra.username,
                    ra.framedipaddress,
                    ra.acctstarttime,
                    c.*
                FROM radacct ra

                INNER JOIN customers c
                    ON c.username = ra.username

                WHERE ra.framedipaddress = ?

                ORDER BY
                    ra.acctstarttime DESC

                LIMIT 1
                `,
                [ip]
            );

            if (!rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Customer not found"
                });

            }

            const customer = rows[0];

            /*
             * Now get the customer's package.
             *
             * CHANGE package table/column names if your
             * existing schema uses different names.
             */

            let packageData = null;

            if (customer.package_id) {

                const [packages]: any =
                    await pool.query(
                        `
                        SELECT *
                        FROM packages
                        WHERE id = ?
                        LIMIT 1
                        `,
                        [customer.package_id]
                    );

                if (packages.length) {

                    packageData = packages[0];

                }

            }

            return res.json({

                success: true,

                customer: {

                    id: customer.id,

                    username:
                        customer.username,

                    first_name:
                        customer.first_name,

                    last_name:
                        customer.last_name,

                    phone:
                        customer.phone,

                    email:
                        customer.email,

                    status:
                        customer.status,

                    expiry_date:
                        customer.expiry_date,

                    balance:
                        customer.balance,

                    package_id:
                        customer.package_id,

                    site_id:
                        customer.site_id,

                    ip:
                        customer.framedipaddress,

                    package: packageData
                }

            });

        } catch (error) {

            console.error(
                "Customer portal identification error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });

        }

    }
);


/**
 * Get customer by customer ID.
 */
router.get(
    "/customer/:id",
    portalAuth,
    async (req: Request, res: Response) => {

        try {

            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {

                return res.status(400).json({
                    success: false,
                    message: "Invalid customer ID"
                });

            }

            const [rows]: any =
                await pool.query(
                    `
                    SELECT *
                    FROM customers
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [id]
                );

            if (!rows.length) {

                return res.status(404).json({
                    success: false,
                    message: "Customer not found"
                });

            }

            const customer = rows[0];

            let packageData = null;

            if (customer.package_id) {

                const [packages]: any =
                    await pool.query(
                        `
                        SELECT *
                        FROM packages
                        WHERE id = ?
                        LIMIT 1
                        `,
                        [customer.package_id]
                    );

                if (packages.length) {
                    packageData = packages[0];
                }

            }

            return res.json({

                success: true,

                customer: {
                    ...customer,
                    package: packageData
                }

            });

        } catch (error) {

            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Internal server error"
            });

        }

    }
);


export default router;