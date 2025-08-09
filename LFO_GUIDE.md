# LFO System Guide

## Overview

The fluid-audio application now includes a comprehensive LFO (Low Frequency Oscillator) system that allows you to apply customizable oscillation to every parameter in the HUD interface. This system is fully mobile-friendly and provides real-time visual feedback.

## Features

### LFO Engine
- **Multiple Waveforms**: Sine, Triangle, Square, Sawtooth, and Noise
- **Customizable Parameters**: Rate, Depth, Offset, Phase
- **Bipolar/Unipolar Modes**: Choose how the oscillation is applied
- **Sync Option**: Reset phase when LFO is enabled
- **Real-time Visualization**: Live waveform display with current position indicator

### Mobile-Friendly Interface
- **Touch Optimized**: All controls are sized for touch interaction (44px minimum)
- **Responsive Layout**: Adapts to different screen sizes
- **Gesture Support**: Proper touch handling for sliders and controls
- **Accessibility**: Focus states and high contrast mode support

## Using the LFO System

### Basic Usage

1. **Open the HUD**: Navigate to `?mode=hud` in your browser
2. **Find LFO Controls**: Each parameter now has two small buttons next to it:
   - **~ Button**: Toggle LFO on/off for this parameter
   - **⚙ Button**: Open detailed LFO settings

3. **Enable LFO**: Click the `~` button to activate LFO for a parameter
   - The button will turn green when active
   - A small indicator will show the LFO is running

4. **Configure LFO**: Click the `⚙` button to open the settings panel

### LFO Parameters

#### Waveform Types
- **Sine**: Smooth, natural oscillation
- **Triangle**: Linear up/down ramps
- **Square**: Hard on/off switching
- **Sawtooth**: Gradual rise, sharp fall
- **Noise**: Random values (useful for chaos)

#### Controls
- **Rate**: Oscillation speed in Hz (0.01 - 10 Hz)
- **Depth**: How much of the parameter range to use (0-100%)
- **Offset**: Center point of oscillation (0-100%)
- **Phase**: Phase offset in degrees (0-360°)
- **Bipolar**: When enabled, oscillates around the offset point
- **Sync**: When enabled, resets phase each time LFO is activated

### Advanced Features

#### Copy/Paste Settings
- **Copy**: Save current LFO settings to clipboard
- **Paste**: Load LFO settings from clipboard
- Useful for applying the same LFO configuration to multiple parameters

#### Master LFO Control
- **LFO Master** button: Enable/disable all LFOs at once
- Useful for quickly turning off all modulation

#### Visual Feedback
- **Waveform Display**: Shows the current waveform shape and settings
- **Position Indicator**: Red dot shows current position in the cycle
- **Active Indicator**: Green glow when LFO is affecting the parameter

## Mobile Usage Tips

### Touch Controls
- **Larger Touch Targets**: All buttons and sliders are optimized for fingers
- **Gesture Support**: Sliders support touch dragging
- **Prevent Zoom**: Interface prevents accidental zoom on input focus

### Screen Adaptation
- **Responsive Layout**: Controls stack vertically on narrow screens
- **Scrollable Interface**: Long parameter lists scroll smoothly
- **Full-Width Design**: Takes advantage of available screen space

### Performance
- **Efficient Updates**: LFOs run at 60fps with minimal CPU usage
- **Smart Rendering**: Only updates when values change
- **Memory Conscious**: Automatically cleans up unused resources

## Integration with Existing Features

### MIDI Support
- LFO parameters work alongside existing MIDI mappings
- Manual parameter changes update LFO base values
- MIDI controllers can override LFO values temporarily

### Recording
- LFO modulation is captured in recordings
- All parameter automation is preserved
- Smooth playback of complex modulations

### Presets
- LFO settings are included in parameter resets
- Copy/paste allows manual preset management
- Future versions will include full preset system

## Technical Details

### Architecture
- **LFO Engine**: Core oscillator with multiple waveform generators
- **LFO Manager**: Handles multiple LFOs and parameter mapping
- **LFO Panel**: UI component for each parameter
- **Integration Layer**: Connects to existing HUD and server systems

### Performance Optimization
- **RequestAnimationFrame**: Smooth 60fps updates
- **Efficient Calculations**: Optimized waveform generation
- **Smart Updates**: Only sends changes when values differ
- **Memory Management**: Automatic cleanup of unused LFOs

### Customization
The system is designed to be easily extensible:
- Add new waveform types in `lfo.js`
- Modify UI appearance in CSS
- Extend parameter ranges as needed
- Add new LFO modes (e.g., step sequencer)

## Troubleshooting

### Common Issues

1. **LFO Not Responding**
   - Check if Master LFO is enabled
   - Verify parameter-specific LFO is activated
   - Ensure depth is greater than 0

2. **Performance Issues**
   - Reduce number of active LFOs
   - Lower update rate if needed
   - Check browser performance tools

3. **Mobile Issues**
   - Ensure viewport meta tags are present
   - Check touch event handling
   - Verify responsive CSS is loaded

### Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge (latest versions)
- **Mobile Support**: iOS Safari, Chrome Mobile, Firefox Mobile
- **Required Features**: ES6 modules, Canvas API, Web Audio API

## Examples

### Creating a Pulsing Effect
1. Select a color or intensity parameter
2. Enable LFO with Sine wave
3. Set Rate to 1-2 Hz
4. Set Depth to 50-80%
5. Adjust Offset to taste

### Rhythmic Modulation
1. Choose Square or Triangle wave
2. Set Rate to match desired tempo
3. Use higher Depth for dramatic changes
4. Experiment with Phase for timing

### Chaos and Randomness
1. Select Noise waveform
2. Set moderate Rate (0.5-2 Hz)
3. Adjust Depth based on desired chaos level
4. Great for organic, unpredictable movement

## Future Enhancements

### Planned Features
- **Preset System**: Save/load complete LFO configurations
- **Step Sequencer**: Pattern-based modulation
- **LFO-to-LFO**: Use one LFO to modulate another
- **MIDI Sync**: Sync LFO rates to MIDI clock
- **Advanced Waveforms**: Custom waveform editor

### Community Contributions
The LFO system is designed to be extensible. Contributions welcome for:
- New waveform types
- UI improvements
- Performance optimizations
- Mobile enhancements
- Documentation improvements

---

For technical questions or contributions, refer to the main project documentation and architecture guide.
