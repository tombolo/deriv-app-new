import LZString from 'lz-string';
import localForage from 'localforage';
import DBotStore from '../scratch/dbot-store';
import { save_types } from '../constants/save-type';

// Hardcoded XML strategies
const HARDCODED_STRATEGIES = {
    'gle-traders-1': {
        id: 'gle-traders-1',
        name: 'GLE Traders 1',
        xml: `
            <xml xmlns="https://developers.google.com/blockly/xml" collection="true" is_dbot="true">
                <!-- Your GLE Traders 1 blocks here -->
                <block type="strategies" deletable="false" movable="false">
                    <field name="STRATEGY_NAME">GLE Traders 1</field>
                    <!-- Add more blocks as needed -->
                </block>
            </xml>
        `,
        timestamp: Date.now(),
        save_type: save_types.LOCAL,
    },
    'gle-traders-2': {
        id: 'gle-traders-2',
        name: 'GLE Traders 2',
        xml: `
            <xml xmlns="https://developers.google.com/blockly/xml" collection="true" is_dbot="true">
                <!-- Your GLE Traders 2 blocks here -->
                <block type="strategies" deletable="false" movable="false">
                    <field name="STRATEGY_NAME">GLE Traders 2</field>
                    <!-- Add more blocks as needed -->
                </block>
            </xml>
        `,
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
        .sort((a, b) => {
            return new Date(a.timestamp) - new Date(b.timestamp);
        })
        .reverse();

    if (workspaces.length > 10) {
        workspaces.pop();
    }
    updateListStrategies(workspaces);
    localForage.setItem('saved_workspaces', LZString.compress(JSON.stringify(workspaces)));
};

export const getSavedWorkspaces = async () => {
    try {
        const saved = JSON.parse(LZString.decompress(await localForage.getItem('saved_workspaces'))) || [];

        // Merge hardcoded strategies with saved ones
        const hardcoded = Object.values(HARDCODED_STRATEGIES);
        const merged = [...hardcoded, ...saved];

        // Remove duplicates (in case a hardcoded strategy was modified and saved)
        const unique = merged.reduce((acc, current) => {
            const x = acc.find(item => item.id === current.id);
            if (!x) {
                return acc.concat([current]);
            } else {
                return acc;
            }
        }, []);

        return unique;
    } catch (e) {
        return Object.values(HARDCODED_STRATEGIES);
    }
};

export const getHardcodedStrategy = strategy_id => {
    return HARDCODED_STRATEGIES[strategy_id];
};

export const loadHardcodedStrategy = strategy_id => {
    const strategy = HARDCODED_STRATEGIES[strategy_id];
    if (!strategy) return false;

    const parser = new DOMParser();
    const xmlDom = parser.parseFromString(strategy.xml, 'text/xml').documentElement;
    const convertedXml = convertStrategyToIsDbot(xmlDom);

    Blockly.Xml.domToWorkspace(convertedXml, Blockly.derivWorkspace);
    Blockly.derivWorkspace.current_strategy_id = strategy_id;
    return true;
};

export const removeExistingWorkspace = async workspace_id => {
    // Don't allow deletion of hardcoded strategies
    if (HARDCODED_STRATEGIES[workspace_id]) return false;

    const workspaces = await getSavedWorkspaces();
    const current_workspace_index = workspaces.findIndex(workspace => workspace.id === workspace_id);

    if (current_workspace_index >= 0) {
        workspaces.splice(current_workspace_index, 1);
    }

    await localForage.setItem('saved_workspaces', LZString.compress(JSON.stringify(workspaces)));
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
