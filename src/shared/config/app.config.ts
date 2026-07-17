import { registerAs } from '@nestjs/config';

export default registerAs('appConfig', () => ({
    // Auth configurations
    auth: {
        jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'fallback-super-secret-key',
        jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        jwtVerificationSecret: process.env.JWT_VERIFICATION_SECRET,
        // Parsing this into a number to prevent calculations on strings!
        bcryptSaltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10),
    },

    // Email configurations

    // Object Store Configuration (e.g S3, Cloudinary, etc)

    // Google configuration

    // Frontendurl Configuration
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

}));
