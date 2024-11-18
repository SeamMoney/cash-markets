// src/config/EnvManager.ts

interface EnvConfig {
    NODE_URL: string;
    CHAIN_MODE: string;
    ZION_API_URL: string;
    ZION_APP_URL: string;
    DEV_MODE: string;
    ADMIN_ACCOUNT_PRIVATE_KEY: string;
    MODULE_ADDRESS: string;
    CRASH_RESOURCE_ACCOUNT_ADDRESS: string;
    LP_RESOURCE_ACCOUNT_ADDRESS: string;
    CASH_RESOURCE_ACCOUNT_ADDRESS: string;
}

function getConfig(): EnvConfig {
    const {
        APTOS_NODE,
        CHAIN_MODE,
        ZION_API_URL,
        ZION_APP_URL,
        DEV_MODE,
        ADMIN_ACCOUNT_PRIVATE_KEY,
        MODULE_ADDRESS,
        CRASH_RESOURCE_ACCOUNT_ADDRESS,
        LP_RESOURCE_ACCOUNT_ADDRESS,
        CASH_RESOURCE_ACCOUNT_ADDRESS
    } = process.env;

    if (!APTOS_NODE || !CHAIN_MODE || !DEV_MODE ||
        !ADMIN_ACCOUNT_PRIVATE_KEY || !MODULE_ADDRESS || !CRASH_RESOURCE_ACCOUNT_ADDRESS ||
        !LP_RESOURCE_ACCOUNT_ADDRESS || !CASH_RESOURCE_ACCOUNT_ADDRESS) {
        const envs = [APTOS_NODE,
            CHAIN_MODE,
            ZION_API_URL,
            ZION_APP_URL,
            DEV_MODE,
            ADMIN_ACCOUNT_PRIVATE_KEY,
            MODULE_ADDRESS,
            CRASH_RESOURCE_ACCOUNT_ADDRESS,
            LP_RESOURCE_ACCOUNT_ADDRESS,
            CASH_RESOURCE_ACCOUNT_ADDRESS]
        for (let i = 0; i < envs.length; i++) {
            if (!envs[i]) {
                console.log(i, envs)
            }
        }

        throw new Error('One or more environment variables are not defined');
    }

    const config: EnvConfig = {
        NODE_URL: APTOS_NODE,
        CHAIN_MODE: CHAIN_MODE,
        ZION_API_URL: DEV_MODE === 'local' ? 'http://localhost:3008' : 'https://api.zionapi.xyz',
        ZION_APP_URL: DEV_MODE === 'local' ? 'http://localhost:3000' : 'https://app.zion.bet',
        DEV_MODE: DEV_MODE,
        ADMIN_ACCOUNT_PRIVATE_KEY: ADMIN_ACCOUNT_PRIVATE_KEY as string,

        MODULE_ADDRESS: MODULE_ADDRESS as string,
        CRASH_RESOURCE_ACCOUNT_ADDRESS: CRASH_RESOURCE_ACCOUNT_ADDRESS as string,
        LP_RESOURCE_ACCOUNT_ADDRESS: LP_RESOURCE_ACCOUNT_ADDRESS as string,
        CASH_RESOURCE_ACCOUNT_ADDRESS: CASH_RESOURCE_ACCOUNT_ADDRESS as string
    };
    console.log(config)

    return config;
}


export default getConfig;
