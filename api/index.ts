import app, { serverPromise } from '../server/index';

export default async (req: any, res: any) => {
    console.log(`[Vercel] Request received: ${req.method} ${req.url}`);
    const initStart = Date.now();

    try {
        // Log initialization start
        console.log('[Vercel] Awaiting serverPromise...');

        // Use a timeout for initialization to avoid silent deaths
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Server initialization timed out after 8s')), 8000)
        );

        await Promise.race([serverPromise, timeoutPromise]);

        console.log(`[Vercel] Server initialized in ${Date.now() - initStart}ms`);
        return app(req, res);
    } catch (error) {
        const duration = Date.now() - initStart;
        console.error(`[Vercel] Initialisation error after ${duration}ms:`, error);

        res.status(500).json({
            message: 'Failed to initialize server',
            detail: error instanceof Error ? error.message : String(error),
            duration,
            timestamp: new Date().toISOString()
        });
    }
};
