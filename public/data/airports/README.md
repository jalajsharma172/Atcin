# Airport Configuration Files

This folder contains JSON configuration files for airports. Each airport has its own JSON file named with its ICAO code.

## File Naming Convention
- **Format:** `{AIRPORT_CODE}.json`
- **Example:** `IGIA.json`, `ORD.json`, `JFK.json`

## How to Add a New Airport

1. Create a new file in this folder with the airport's ICAO code (e.g., `ORD.json`)
2. Copy the template below and fill in the values
3. Save the file
4. The airport will automatically be available in the simulator

## Template

```json
{
  "code": "AIRPORT_CODE",
  "name": "Airport Full Name",
  "elevation": 0,
  "runways": [
    {
      "name": "27L",
      "x": 0,
      "y": 0,
      "heading": 270,
      "length": 10,
      "endX": 10,
      "endY": 0
    }
  ],
  "fixes": {
    "FIXNAME": { "x": 10, "y": 10 }
  },
  "terminals": []
}
```

## Field Explanations

### Airport Level
- **code**: ICAO airport code (e.g., "IGIA", "ORD", "JFK")
- **name**: Full airport name
- **elevation**: Airport elevation in feet MSL (Mean Sea Level)

### Runways
- **name**: Runway identifier (e.g., "27L", "09R", "36")
- **x, y**: Starting coordinates in nautical miles (center of map is 0, 0)
- **endX, endY**: Ending coordinates in nautical miles
- **heading**: Runway heading in degrees (0-360)
- **length**: Runway length in nautical miles

### Fixes
Navigation waypoints that pilots can be directed to:
- **Key**: Fix name (e.g., "JORDD", "ALFIX")
- **Value**: Coordinates { x, y } in nautical miles

### Terminals
Optional terminal buildings for visual display (can be left empty: `[]`)

## Current Airports
- `IGIA.json` - Indira Gandhi International Airport (Delhi)

## Notes
- Coordinates are relative to the center of the radar (0, 0)
- Positive X = East, Negative X = West
- Positive Y = North, Negative Y = South
- All distances are in nautical miles
