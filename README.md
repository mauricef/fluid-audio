# mossy.xyz

## Installation

### Active Python Environment (optional)

```bash
python -m venv venv
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

## Running the Server

To run a simple HTTP server with SSLon port 5000, or the next available port:
```bash
python server.py
```

r1c1 - JetCount: number of jets
r1c2 - JetColorAlpha: how much of the jet color are you mixing in - 0 means won't see jets, but jets will still be disturbing the fluid
r1c3 - PerimeterRotate: jets rotating
r1c4 - PerimeterRadius: how big the whole circle is
r1c5 - ColorRadiusRelMax: how big the jet color circle is
r1c6 - JetLength: how many pixels you're adding velocity to - small means spiky shoots
r1c7 - JetSpeed: how hard your pushing shoots out
r1c8 - JetRotate: to make them point straight out, rotate them until they are straight and then set to .5
r2c1 - SpiralLoops: how many rotations of spiral
r2c2 - SpiralInward: how spirally it is. 1 for circle. if it's 1 then spiral loops doesn't matter
r2c3 - BlockCount: how many blocks. low = big blocks, high = small blocks
r2c4 - GridSize: zoom in and out on entire grid
r2c5 - BlockMargin: margin around each grid block. larger = smaller blocks
r2c6 - BlockBlur: max is blurry blocks. slightly higher than zero for crisp grids. zero is glitch, max for monet.
r2c7 - BlockAlpha: turns grid on. how rapidly it changes the color. faded dreamy effect if you turn it down, turn it up the color changes rapidly. music strong, set to 1
r2c8 - GlobalAlphaDecay: turn up for flashy decay (fade to black). goes well grid alpha max also
r3c1 - GlobalSpeedDecay: how much the jets fade as they shoot. low = they'll make it to the edges, high = they will fade quickly
r3c2 - AudioStart: 0-22khz - play with these two to capture the variance
r3c3 - AudioLength: from start, how much bandwidth
r3c4 - AudioGain: max it for craziness
r3c5 - ColorXStart: same as audio kind of
r3c6 - ColorXLength: same as audio. longer length and lower start mean more colors
r3c7 - ColorYDrift - scans through image and changes color of jets slow or fast



## Running the Client
To run the client, go to https://localhost:5000?mode=server and https://localhost:5000?mode=hud in your browser.