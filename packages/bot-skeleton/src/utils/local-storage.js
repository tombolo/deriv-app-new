import LZString from 'lz-string';
import localForage from 'localforage';
import DBotStore from '../scratch/dbot-store';
import { save_types } from '../constants/save-type';

// File-based strategy configuration
const FILE_BASED_STRATEGIES = {
    'auto-robot-gle1': {
        id: 'auto-robot-gle1',
        name: 'Auto Robot by GLE1',
        filename: 'Auto_robot_by_GLE1.xml',
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    // Add more file-based strategies here as needed
};

/**
 * Load strategy XML from public/bots directory
 */
const loadStrategyFromFile = async filename => {
    try {
        const response = await fetch(`/bots/${filename}`);
        if (!response.ok) throw new Error('Failed to load strategy');
        return await response.text();
    } catch (error) {
        console.error(`Error loading strategy ${filename}:`, error);
        return null;
    }
};

/**
 * Get all file-based strategies with their XML content
 */
const getFileStrategies = async () => {
    const strategies = [];

    for (const [strategyId, config] of Object.entries(FILE_BASED_STRATEGIES)) {
        const xml = await loadStrategyFromFile(config.filename);
        if (xml) {
            strategies.push({
                id: strategyId,
                name: config.name,
                xml,
                timestamp: config.timestamp,
                save_type: config.save_type,
                is_file_based: true,
            });
        }
    }

    return strategies;
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

    // Sort by timestamp (newest first) and keep only 10 most recent
    workspaces.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

    updateListStrategies(workspaces);
    localForage.setItem('saved_workspaces', LZString.compress(JSON.stringify(workspaces)));
};

export const getSavedWorkspaces = async () => {
    try {
        const saved = JSON.parse(LZString.decompress(await localForage.getItem('saved_workspaces'))) || [];
        const fileStrategies = await getFileStrategies();

        // Merge strategies, giving priority to saved versions
        const merged = [...fileStrategies];
        saved.forEach(savedStrategy => {
            if (!fileStrategies.some(fs => fs.id === savedStrategy.id)) {
                merged.push(savedStrategy);
            }
        });

        return merged;
    } catch (e) {
        return await getFileStrategies();
    }
};

export const loadStrategy = async strategy_id => {
    // First try to load from files
    const fileStrategies = await getFileStrategies();
    const fileStrategy = fileStrategies.find(s => s.id === strategy_id);
    if (fileStrategy) {
        return loadXmlToWorkspace(fileStrategy.xml, strategy_id);
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
    // Don't allow deletion of file-based strategies
    if (FILE_BASED_STRATEGIES[workspace_id]) return false;

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
