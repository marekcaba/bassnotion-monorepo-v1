/**
 * WAM Keyboard GUI Module
 * 
 * Provides the graphical user interface for the WAM Keyboard plugin.
 * Follows WAM 2.0 standard for GUI modules.
 */

import type { WamKeyboard } from './WamKeyboard.js';

/**
 * Create the GUI element for the WAM Keyboard plugin
 * 
 * @param plugin - The WAM Keyboard plugin instance
 * @returns HTMLElement containing the plugin GUI
 */
export async function createElement(plugin: WamKeyboard): Promise<HTMLElement> {
  const container = document.createElement('div');
  container.className = 'wam-keyboard-gui';
  container.style.cssText = `
    padding: 20px;
    background: #2a2a2a;
    color: #fff;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    width: 300px;
  `;
  
  container.innerHTML = `
    <style>
      .wam-keyboard-gui h3 {
        margin: 0 0 15px 0;
        font-size: 18px;
        font-weight: 600;
      }
      .wam-keyboard-gui .control-group {
        margin-bottom: 15px;
      }
      .wam-keyboard-gui label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        opacity: 0.8;
      }
      .wam-keyboard-gui select,
      .wam-keyboard-gui input[type="range"] {
        width: 100%;
        background: #1a1a1a;
        border: 1px solid #444;
        color: #fff;
        padding: 5px;
        border-radius: 4px;
      }
      .wam-keyboard-gui input[type="range"] {
        -webkit-appearance: none;
        height: 6px;
        padding: 0;
      }
      .wam-keyboard-gui input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        width: 14px;
        height: 14px;
        background: #4a9eff;
        border-radius: 50%;
        cursor: pointer;
      }
      .wam-keyboard-gui .volume-display {
        text-align: center;
        font-size: 12px;
        opacity: 0.6;
        margin-top: 5px;
      }
    </style>
    
    <h3>🎹 WAM Keyboard</h3>
    
    <div class="control-group">
      <label for="wam-keyboard-instrument">Instrument</label>
      <select id="wam-keyboard-instrument">
        <option value="0">Salamander Grand Piano</option>
        <option value="1">Fender Rhodes</option>
        <option value="2">Wurlitzer EP</option>
      </select>
    </div>
    
    <div class="control-group">
      <label for="wam-keyboard-volume">Volume</label>
      <input type="range" id="wam-keyboard-volume" min="0" max="1" step="0.01" value="0.8">
      <div class="volume-display" id="wam-keyboard-volume-display">80%</div>
    </div>
    
    <div class="control-group">
      <label>
        <input type="checkbox" id="wam-keyboard-sustain" style="margin-right: 5px;">
        Sustain Pedal
      </label>
    </div>
  `;
  
  // Get current parameter values
  const params = await plugin.audioNode?.getParameterValues();
  
  // Wire up controls
  const instrumentSelect = container.querySelector('#wam-keyboard-instrument') as HTMLSelectElement;
  const volumeSlider = container.querySelector('#wam-keyboard-volume') as HTMLInputElement;
  const volumeDisplay = container.querySelector('#wam-keyboard-volume-display') as HTMLElement;
  const sustainCheckbox = container.querySelector('#wam-keyboard-sustain') as HTMLInputElement;
  
  // Set initial values
  if (params) {
    instrumentSelect.value = params.instrument.toString();
    volumeSlider.value = params.volume.toString();
    volumeDisplay.textContent = `${Math.round(params.volume * 100)}%`;
    sustainCheckbox.checked = params.sustain > 0.5;
  }
  
  // Instrument selector
  instrumentSelect.addEventListener('change', async () => {
    await plugin.audioNode?.setParameterValues({
      instrument: parseInt(instrumentSelect.value)
    });
  });
  
  // Volume control
  volumeSlider.addEventListener('input', async () => {
    const volume = parseFloat(volumeSlider.value);
    volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
    await plugin.audioNode?.setParameterValues({ volume });
  });
  
  // Sustain pedal
  sustainCheckbox.addEventListener('change', async () => {
    await plugin.audioNode?.setParameterValues({
      sustain: sustainCheckbox.checked ? 1 : 0
    });
  });
  
  return container;
}

export default { createElement };