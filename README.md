# Voyager Simulator

A WebXR arcade space shooter built with A-Frame. Playable on desktop and virtual reality headsets.

> **Play it online:** <https://heyvr.io/arcade/games/voyager-simulator>

## About the game

Pilot your spacecraft through the cosmos on a critical mission. Your goal is simple but challenging: clean up dangerous space debris and scan massive asteroids for data. Using intuitive head-based controls, you experience space combat without needing any controllers. Just look, lock, and fire.

This is the first VR game I built. It started as a way to learn WebXR game development, and it grew into a complete project with a story campaign, weapon progression, and global leaderboards. I put a lot of time into learning A-Frame, 3D scene optimization, and game balance. I am happy to share it, and I hope you enjoy playing it as much as I enjoyed building it.

## Features

- **Hands-free combat** - No controllers needed. Look at a target to aim and engage.
- **8 unique weapons** - From the standard Blaster to the high-tech PHOTON, the sun-powered SOLAR railgun, and the ultimate OMEGA.
- **Story campaign** - A fully voiced narrative journey across the Solar System. Complete missions and uncover the mysteries of the void.
- **Tactical upgrades** - Better weapons are not just for destruction. Weapons costing 5000+ PTS noticeably reduce scanning time.
- **Global leaderboards** - Compete with other pilots for a spot on the expanded Top 8 Commanders list.
- **Visual spectacle** - Witness massive supernovas, realistic explosions, and a living starfield that reacts to your gaze.

## How to play

1. **Aim** - Move your head to control the crosshair.
2. **Destroy** - Look at space junk to auto-lock and shoot.
3. **Scan** - Focus on asteroids to scan them and earn +4 Passes. Tip: equip better weapons to scan faster.
4. **Survive** - Do not let junk escape if you run out of passes, or it is game over.
5. **Progress** - The game gets faster and harder. Can you reach the rapid fire mode?

## Weapons

| Weapon | Unlock |
| --- | --- |
| Blaster | Available from the start |
| Plasma | Available from the start |
| Laser | Reachable early |
| Railgun | 5000 PTS |
| Photon | 8000 PTS |
| Void | 10000 PTS |
| Omega | 12000 PTS |
| Solar | 15000 PTS |

## Running locally

The game is hosted on heyVR, but you can also run it from source. Browsers block textures when a page is opened directly as a file (a CORS restriction), so serve the folder over HTTP:

1. Double-click `start_server.bat`, or run one of these commands from the project folder:
   - `py -m http.server 8000`
   - `node server.js`
2. Open <http://localhost:8000> in your browser.

Note: Features such as global leaderboards and ad integration use the HeyVR SDK and work best when the game is hosted on heyVR.io.

## Tech stack

- [A-Frame](https://aframe.io) - WebXR framework
- [Three.js](https://threejs.org) - 3D rendering (bundled with A-Frame)
- [HeyVR SDK](https://heyvr.io) - Hosting, leaderboards, and ads

## License

Released under the [MIT License](LICENSE).
