export default (req: any, res: any) => {
    res.status(200).json({
        message: "Pong from standalone function",
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV,
        region: process.env.VERCEL_REGION
    });
};
