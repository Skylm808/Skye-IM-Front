import React, { useEffect, useState } from 'react';
import { Avatar } from 'antd';
import request, { GATEWAY_ORIGIN } from '../api/request';
import { getAvatarUrl } from '../utils/image';

const shouldProxyMedia = import.meta.env.DEV;

const toProxyUrl = (url) => {
    if (!shouldProxyMedia || !url || typeof window === 'undefined') return url;
    try {
        const parsed = new URL(url);
        if (parsed.origin === GATEWAY_ORIGIN && window.location.origin !== parsed.origin) {
            return `${parsed.pathname}${parsed.search}${parsed.hash}`;
        }
    } catch (e) {
        return url;
    }
    return url;
};


const AuthAvatar = ({ src, ...props }) => {
    const [imageSrc, setImageSrc] = useState(null);

    useEffect(() => {
        // 1. If no src, just pass null/undefined to Avatar (it handles it by showing icon or children)
        if (!src) {
            setImageSrc(null);
            return;
        }

        const fullUrl = getAvatarUrl(src);
        const requestUrl = toProxyUrl(fullUrl);

        // 2. If it's data URL or already a blob URL, use directly
        if (fullUrl.startsWith('data:') || fullUrl.startsWith('blob:')) {
            setImageSrc(fullUrl);
            return;
        }

        // 3. Fetch with auth
        let active = true;

        const fetchImage = async () => {
            try {
                // console.log('AuthAvatar fetching:', fullUrl);
                const response = await request.get(requestUrl, {
                    responseType: 'blob',
                    headers: {
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache',
                        // Explicitly override the default Content-Type to avoid backend issues with static files
                        // Some backends/middleware might check Content-Type even on GET
                        'Content-Type': 'application/x-www-form-urlencoded'
                    }
                });

                const blob = response instanceof Blob ? response : response?.data;
                if (!blob) {
                    throw new Error('Empty avatar response');
                }

                if (active) {
                    const url = URL.createObjectURL(blob);
                    setImageSrc(url);
                }
            } catch (e) {
                console.error('Failed to load avatar', requestUrl, e);
                // Fallback: try using the URL directly (maybe it doesn't need auth, or 401 will show broken image)
                if (active) setImageSrc(requestUrl);
            }
        };

        fetchImage();

        return () => {
            active = false;
        };
    }, [src]);

    // Clean up object URL when component unmounts or imageSrc changes
    useEffect(() => {
        return () => {
            if (imageSrc && imageSrc.startsWith('blob:')) {
                URL.revokeObjectURL(imageSrc);
            }
        };
    }, [imageSrc]);

    return <Avatar src={imageSrc} {...props} />;
};

export default AuthAvatar;
