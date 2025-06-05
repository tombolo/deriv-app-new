import LZString from 'lz-string';
import localForage from 'localforage';
import DBotStore from '../scratch/dbot-store';
import { save_types } from '../constants/save-type';
import Strategy1 from '../bots/Auto_robot_by_GLE1';
import Strategy2 from '../bots/Over_under_by_GLE';

// Imported XML strategies
const IMPORTED_STRATEGIES = {
    'auto-robot-gle1': {
        id: 'auto-robot-gle1',
        name: 'Auto Robot by GLE1',
        xml: Strategy1,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    'over-under-gle': {
        id: 'over-under-gle',
        name: 'Over Under by GLE',
        xml: Strategy2,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
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

    workspaces
        .sort((a, b) => b.timestamp - a.timestamp) // Newest first
        .slice(0, 10); // Keep only 10 most recent

    updateListStrategies(workspaces);
    localForage.setItem('saved_workspaces', LZString.compress(JSON.stringify(workspaces)));
};

export const getSavedWorkspaces = async () => {
    try {
        const saved = JSON.parse(LZString.decompress(await localForage.getItem('saved_workspaces'))) || [];

        // Merge imported strategies with saved ones
        const imported = Object.values(IMPORTED_STRATEGIES);
        const merged = [...imported, ...saved];

        // Remove duplicates (give priority to saved versions)
        const unique = merged.reduce((acc, current) => {
            if (!acc.some(item => item.id === current.id)) {
                return [...acc, current];
            }
            return acc;
        }, []);

        return unique;
    } catch (e) {
        return Object.values(IMPORTED_STRATEGIES);
    }
};

export const loadStrategy = async strategy_id => {
    // First try to load imported strategies
    if (IMPORTED_STRATEGIES[strategy_id]) {
        return loadXmlToWorkspace(IMPORTED_STRATEGIES[strategy_id].xml, strategy_id);
    }

    // Fall back to saved strategies
    const savedStrategies = await getSavedWorkspaces();
    const savedStrategy = savedStrategies.find(s => s.id === strategy_id);
    if (savedStrategy) {
        return loadXmlToWorkspace(savedStrategy.xml, strategy_id);
    }

    return false;
};

const loadXmlToWorkspace = (xml, strategy_id) => {
    try {
        const parser = new DOMParser();
        const xmlDom = parser.parseFromString(xml, 'text/xml').documentElement;
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
    // Don't allow deletion of imported strategies
    if (IMPORTED_STRATEGIES[workspace_id]) return false;

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
