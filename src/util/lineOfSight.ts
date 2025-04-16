import * as turf from '@turf/turf'
import { getElevation } from './hgt'

/**
 *
 * @param bearing -180 to 180 (0 is north, -90 is west, 90 is east)
 * @param pitch -180 to 180 (+ means up)
 * @param precision in meters (how often measurements should take place, large values might miss hills or mountain tops). This should be choosen relative to the terrain elevation data precision (grid size)
 * @param maxDistance in meters
 * @see calculateLineOfSight()
 */
export async function calculateMaxLineOfSight(startLongitude: number, startLatitude: number, startAltitude: number, bearing: number, pitch: number, precision: number, maxDistance: number){

    const normalized = normalizePitchAndBearing(pitch, bearing)

    let currentDistance = precision

    while(currentDistance <= maxDistance){

        const {distanceInDegrees, altitude} = getDistanceInDegreesAndAltitudeForDistance(startAltitude, normalized.pitch, currentDistance)

        const currentPosition = turf.destination([startLongitude, startLatitude], distanceInDegrees, normalized.bearing, {
            units: 'degrees'
        })

        const isBelowTerrain = await isAltitudeBelowTerrain(currentPosition.geometry.coordinates[0], currentPosition.geometry.coordinates[1], altitude)

        if(isBelowTerrain){
            return {
                position: {
                    longitude: currentPosition.geometry.coordinates[0],
                    latitude: currentPosition.geometry.coordinates[1]
                },
                elevation: altitude
            }
        }

        currentDistance += precision
    }

    return false
}


/**
 * does not colide with terrain
 * @param bearing -180 to 180 (0 is north, -90 is west, 90 is east)
 * @param pitch -180 to 180 (+ means up)
 * @param precision in meters (how often measurements should take place, large values might miss hills or mountain tops). This should be choosen relative to the terrain elevation data precision (grid size)
 * @param maxDistance in meters
 * @see calculateMaxLineOfSight()
 */
export function calculateLineOfSight(startLongitude: number, startLatitude: number, startAltitude: number, bearing: number, pitch: number, distance: number){

    const normalized = normalizePitchAndBearing(pitch, bearing)


    const {distanceInDegrees, altitude} = getDistanceInDegreesAndAltitudeForDistance(startAltitude, normalized.pitch, distance)

    const currentPosition = turf.destination([startLongitude, startLatitude], distanceInDegrees, normalized.bearing, {
        units: 'degrees'
    })

    return {
        position: {
            longitude: currentPosition.geometry.coordinates[0],
            latitude: currentPosition.geometry.coordinates[1]
        },
        elevation: altitude
    }
}

/**
 * @param precision in meters
 */
export async function isTerrainBetween(longitudeA: number, latitudeA: number, altitudeA: number, longitudeB: number, latitudeB: number, pitch: number, precision: number){
    const center = turf.midpoint([longitudeA, latitudeA], [longitudeB, latitudeB])

    const distanceInDegrees = turf.distance([longitudeA, latitudeA], [longitudeB, latitudeB], {
        units: 'degrees'
    })

    const centerAltitude = getAltitudeAtDistanceInDegrees(altitudeA, pitch, distanceInDegrees/2)
    const isBelowTerrain = await isAltitudeBelowTerrain(center.geometry.coordinates[0], center.geometry.coordinates[1], centerAltitude)

    if(isBelowTerrain){
        return true
    } else {
        if(turf.distance([longitudeA, latitudeA], [longitudeB, latitudeB], {
            units: 'meters'
        }) > precision){
            const isTerrainBetweenAandCenter = await isTerrainBetween(longitudeA, latitudeA, altitudeA, center.geometry.coordinates[0], center.geometry.coordinates[1], pitch, precision)

            if(isTerrainBetweenAandCenter){
                return true
            }

            const isTerrainBetweenBandCenter = await isTerrainBetween(center.geometry.coordinates[0], center.geometry.coordinates[1], centerAltitude, longitudeB, latitudeB, pitch, precision)

            if(isTerrainBetweenBandCenter){
                return true
            }
        }
    }

    return false
}

function getAltitudeAtDistanceInDegrees(altitude: number, pitch: number, distanceInDegrees: number){
    // see file "/dev/line of sight end elevation calculation.png"
    const EARTH_RADIUS = 6378 * 1000

    const r = EARTH_RADIUS + altitude
    const p = toRadians(pitch)
    const d = toRadians(distanceInDegrees)
    const r1 = r * ((Math.tan(d) / Math.tan(p)) + 1)
    const r2 = r - r1
    const e = r2 / Math.cos(d)

    return e
}

/**
 *
 * @param pitch -90 to 90
 * @param distanceInMeters
 * @returns
 */
function getDistanceInDegreesAndAltitudeForDistance(altitude: number, pitch: number, distanceInMeters: number){

    if(pitch >= 90 || pitch <= -90){
        throw new Error('pitch value outside of valid range -90 to 90')
    }

    // pitch 0 means 90°
    const normalizedPitch = pitch + 90

    //TODO reenable this check?
    // if(normalizedPitch > 90){
    //     throw new Error('normalizedPitch > 90° not implemented yet')
    // }

    // see file "/dev/line of sight end elevation calculation.png"
    const EARTH_RADIUS = 6378 * 1000

    const r = EARTH_RADIUS + altitude
    const p = toRadians(normalizedPitch)

    const l = distanceInMeters
    const r1 = l * Math.cos(p)
    const r2 = r - r1

    const x = l * Math.sin(p)

    const e = Math.sqrt(x**2 + r2**2)
    const d = Math.acos(r2 / e)

    return {
        altitude: e - EARTH_RADIUS,
        distanceInDegrees: toDegrees(d)
    }

}

async function isAltitudeBelowTerrain(longitude: number, latitude: number, altitude: number){

    return altitude < await getElevation(longitude, latitude)
}

function toRadians(deg: number){
    return deg * Math.PI/180
}

function toDegrees(rad: number){
    return rad / (Math.PI/180)
}

/**
 *
 * @param pitch -180 to 180 (zero means horizontal)
 * @param bearing -180 to 180 (0 means north)
 */
export function normalizePitchAndBearing(pitch: number, bearing: number){

    pitch = pitch % 360

    if(pitch > 90){
        pitch = 180 - pitch
        bearing = (bearing + 180)
    } else if (pitch < -90){
        pitch = -180 - pitch
        bearing += 180
    }

    // prevent special triangle problems
    if(pitch === 90){
        pitch = 89.9
    } else if(pitch === -90){
        pitch = -89.9
    }

    bearing = bearing % 360

    //normalize bearing
    if(bearing > 180){
        bearing -= 360
    } else if(bearing < -180){
        bearing += 360
    }

    return {
        bearing,
        pitch
    }
}