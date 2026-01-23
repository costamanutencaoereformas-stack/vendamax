import app, { serverPromise } from '../server/index';

export default async (req: any, res: any) => {
    try {
        await serverPromise;
        return app(req, res);
    } catch (error) {
        console.error('Initialisation error:', error);
        res.status(500).json({
            message: 'Failed to initialize server',
            detail: error instanceof Error ? error.message : String(error)
        });
    }
};
