import { config } from '../constants';
import { save_types } from '../constants/save-type';
import DBotStore from '../scratch/dbot-store';

// Function to fetch XML content from public folder
const fetchBotXml = async botName => {
    try {
        const response = await fetch(`/bots/${botName}.xml`);
        if (!response.ok) {
            throw new Error(`Failed to load ${botName} bot`);
        }
        return await response.text();
    } catch (error) {
        console.error(`Error loading ${botName} bot:`, error);
        return `<xml xmlns="https://developers.google.com/blockly/xml" is_dbot="true">
                  <!-- Error loading ${botName} bot -->
                </xml>`;
    }
};

// Static bot definitions with async XML loading
const getStaticBots = async () => {
    const [dollarMinerXml, dollarFlipperXml] = await Promise.all([
        fetchBotXml('dollar_miner'),
        fetchBotXml('dollar_flipper'),
    ]);

    return [
        {
            id: 'dollar_miner',
            name: 'Over under bot by GLE',
            xml: dollarMinerXml,
            timestamp: Date.now(),
            save_type: save_types.LOCAL,
        },
        {
            id: 'dollar_flipper',
            name: 'Auto robot by GLE1',
            xml: dollarFlipperXml,
            timestamp: Date.now(),
            save_type: save_types.LOCAL,
        },
        
    ];
};

/**
 * Save workspace to recent (modified to work with static bots)
 */
export const saveWorkspaceToRecent = async (xml, save_type = save_types.UNSAVED) => {
    const xml_dom = convertStrategyToIsDbot(xml);
    xml.setAttribute('is_dbot', true);

    const {
        load_modal: { updateListStrategies },
        save_modal,
    } = DBotStore.instance;

    // For static bots, we just update the list with our predefined bots
    const bots = await getStaticBots();
    updateListStrategies(bots);
};

export const getSavedWorkspaces = async () => {
    // Return our static bots instead of loading from storage
    return await getStaticBots();
};

export const removeExistingWorkspace = async workspace_id => {
    // No-op since we're using static bots
    console.log('Remove operation disabled for static bots');
};

export const convertStrategyToIsDbot = xml_dom => {
    if (!xml_dom) return;
    if (xml_dom.hasAttribute('collection') && xml_dom.getAttribute('collection') === 'true') {
        xml_dom.setAttribute('collection', 'true');
    }
    xml_dom.setAttribute('is_dbot', 'true');
    return xml_dom;
};
