import LZString from 'lz-string';
import localForage from 'localforage';
import DBotStore from '../scratch/dbot-store';
import { save_types } from '../constants/save-type';

const fetchBotXml = async botName => {
    try {
        const response = await fetch(`/videos/${botName}.xml`);
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

const getStaticBots = async () => {
    const [autoRobotXml, overUnderXml] = await Promise.all([
        fetchBotXml('Auto_robot_by_GLE1'),
        fetchBotXml('Over_under_bot_by_GLE'),
    ]);

    return {
        Auto_robot_by_GLE1: {
            id: 'Auto_robot_by_GLE1',
            name: 'Auto robot by GLE1',
            xml: autoRobotXml,
            timestamp: Date.now(),
            save_type: save_types.LOCAL,
        },
        Over_under_bot_by_GLE: {
            id: 'Over_under_bot_by_GLE',
            name: 'Over under bot by GLE',
            xml: overUnderXml,
            timestamp: Date.now(),
            save_type: save_types.LOCAL,
        },
    };
};

/**
 * Save workspace to localStorage
 * @param {String} save_type // constants/save_types.js (unsaved, local, googledrive)
 * @param {Blockly.Events} event // Blockly event object
 */
export const saveWorkspaceToRecent = async (xml, save_type = save_types.UNSAVED) => {
    const xml_dom = convertStrategyToIsDbot(xml);
    const {
        load_modal: { updateListStrategies },
        save_modal,
    } = DBotStore.instance;

    const workspace_id = Blockly.derivWorkspace.current_strategy_id || Blockly.utils.idGenerator.genUid();
    const workspaces = await getSavedWorkspaces();
    const current_xml = Blockly.Xml.domToText(xml_dom);
    const current_timestamp = Date.now();
    const current_workspace_index = workspaces.findIndex(workspace => workspace.id === workspace_id);

    if (current_workspace_index >= 0) {
        const current_workspace = workspaces[current_workspace_index];
        current_workspace.xml = current_xml;
        current_workspace.name = save_modal.bot_name;
        current_workspace.timestamp = current_timestamp;
        current_workspace.save_type = save_type;
    } else {
        workspaces.push({
            id: workspace_id,
            timestamp: current_timestamp,
            name: save_modal.bot_name,
            xml: current_xml,
            save_type,
        });
    }

    workspaces.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
    updateListStrategies(workspaces);
    await localForage.setItem('saved_workspaces', LZString.compress(JSON.stringify(workspaces)));
};

export const getSavedWorkspaces = async () => {
    try {
        const saved = JSON.parse(LZString.decompress(await localForage.getItem('saved_workspaces'))) || [];
        const staticBots = await getStaticBots();

        // Merge strategies, giving priority to saved versions
        const merged = Object.values(staticBots).map(staticBot => {
            const savedVersion = saved.find(s => s.id === staticBot.id);
            return savedVersion || staticBot;
        });

        // Add saved strategies that aren't static bots
        saved.forEach(savedStrategy => {
            if (!staticBots[savedStrategy.id]) {
                merged.push(savedStrategy);
            }
        });

        return merged.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
        console.error('Error loading saved workspaces:', e);
        return Object.values(await getStaticBots());
    }
};

export const loadStrategy = async strategy_id => {
    const workspaces = await getSavedWorkspaces();
    const strategy = workspaces.find(workspace => workspace.id === strategy_id);

    if (!strategy) return false;

    try {
        const parser = new DOMParser();
        const xmlDom = parser.parseFromString(strategy.xml, 'text/xml').documentElement;
        const convertedXml = convertStrategyToIsDbot(xmlDom);

        Blockly.Xml.domToWorkspace(convertedXml, Blockly.derivWorkspace);
        Blockly.derivWorkspace.current_strategy_id = strategy_id;
        return true;
    } catch (error) {
        console.error('Error loading strategy:', error);
        return false;
    }
};

export const removeExistingWorkspace = async workspace_id => {
    const staticBots = await getStaticBots();
    // Don't allow deletion of static bots
    if (staticBots[workspace_id]) return false;

    const workspaces = await getSavedWorkspaces();
    const filtered = workspaces.filter(workspace => workspace.id !== workspace_id);

    await localForage.setItem('saved_workspaces', LZString.compress(JSON.stringify(filtered)));
    return true;
};

export const convertStrategyToIsDbot = xml_dom => {
    if (!xml_dom) return;
    if (xml_dom.hasAttribute('collection') && xml_dom.getAttribute('collection') === 'true') {
        xml_dom.setAttribute('collection', 'true');
    }
    xml_dom.setAttribute('is_dbot', 'true');
    return xml_dom;
};
