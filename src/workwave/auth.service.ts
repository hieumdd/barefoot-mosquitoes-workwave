import axios from 'axios';
import { add, isAfter } from 'date-fns';
import { Timestamp } from '@google-cloud/firestore';

import { AccessToken, tokenCollection } from './token.repository';

export const getClient = async (tenantId: string) => {
    const ensureToken = async () => {
        const token = await tokenCollection
            .doc(tenantId)
            .get()
            .then((doc) => doc.data() as AccessToken | undefined);

        if (token && token.expires_at instanceof Timestamp && isAfter(token.expires_at.toDate(), new Date())) {
            return token.access_token;
        }

        const accessToken = await axios
            .request<AccessToken>({
                method: 'POST',
                url: 'https://is.workwave.com/oauth2/token',
                auth: { username: process.env.WORKWAVE_CLIENT_ID!, password: process.env.WORKWAVE_CLIENT_SECRET! },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                params: { scope: 'openid' },
                data: {
                    grant_type: 'password',
                    username: process.env.WORKWAVE_USERNAME,
                    password: process.env.WORKWAVE_PASSWORD,
                },
            })
            .then((response) => response.data);

        await tokenCollection
            .doc(tenantId)
            .set({ ...accessToken, expires_at: add(new Date(), { seconds: accessToken.expires_in }) });

        return accessToken.access_token;
    };

    const accessToken = await ensureToken();

    return axios.create({
        baseURL: 'https://api.workwave.com/pestpac/v1',
        headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.WORKWAVE_API_KEY,
            'tenant-id': tenantId,
        },
    });
};
