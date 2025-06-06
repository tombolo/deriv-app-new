import { getPlatformSettings, routes } from '@deriv/shared';
import { localize } from '@deriv/translations';
import DbotImage from './images/dbot.png';
import DtraderImage from './images/dtrader.png';
import './platform-config.scss'; // Import the SCSS file

type TPlatformConfig = {
    description: () => string;
    href?: string;
    image: string;  // Changed from icon to image
    link_to?: string;
    name: string;
    title: () => string;
    className?: string; // Added for SCSS styling
};

const platform_config: TPlatformConfig[] = [
    {
        image: DtraderImage, // Using imported image
        title: () => getPlatformSettings('trader').name,
        name: getPlatformSettings('trader').name,
        description: () => localize('D Trader'),
        link_to: routes.trade,
        className: 'platform-card--dtrader' // Added for specific styling
    },
    {
        image: DbotImage, // Using imported image
        title: () => getPlatformSettings('dbot').name,
        name: getPlatformSettings('dbot').name,
        description: () => localize('D Bot'),
        href: routes.bot,
        className: 'platform-card--dbot' // Added for specific styling
    },
];

export default platform_config;