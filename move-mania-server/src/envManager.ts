// src/config/EnvManager.ts

interface EnvConfig {
    NODE_URL: string;
    ZION_API_URL: string;
    ZION_APP_URL: string;
    ADMIN_ACCOUNT_PRIVATE_KEY: string;
    MODULE_ADDRESS: string;
}

function getConfig(): EnvConfig {
    const {
        MODULE_ADDRESS,
        ADMIN_ACCOUNT_PRIVATE_KEY,
        NODE_URL,
        DEV_MODE
    } = process.env;

    console.log(MODULE_ADDRESS)

    if (!MODULE_ADDRESS || !ADMIN_ACCOUNT_PRIVATE_KEY || !NODE_URL) {
        throw new Error('One or more environment variables are not defined');
    }

    const config: EnvConfig = {
        NODE_URL: NODE_URL,
        ZION_API_URL: DEV_MODE === 'local' ? 'http://localhost:3008' : 'https://api.zionapi.xyz',
        ZION_APP_URL: DEV_MODE === 'local' ? 'http://localhost:3000' : 'https://app.zion.bet',
        ADMIN_ACCOUNT_PRIVATE_KEY: ADMIN_ACCOUNT_PRIVATE_KEY as string,
        MODULE_ADDRESS: MODULE_ADDRESS as string,
    };
    return config;
}


export default getConfig;
