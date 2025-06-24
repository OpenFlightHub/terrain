import express from 'express';
import asyncHandler from 'express-async-handler'
import Timer from '../util/timer'
import RayCoverage from '../util/RayCoverage'
import * as turf from '@turf/turf'

const router = express.Router()


const GROUND_COVERAGE_RAY_PRECISION = 1.5 // rays per degree (exponential work load)


router.post('/', asyncHandler(async (req, res) => {

    const lon = req.body.longitude

    if(isNaN(lon)){
        res.status(400).send('invalid longitude')
        return
    }

    const lat = req.body.latitude

    if(isNaN(lat)){
        res.status(400).send('invalid latitude')
        return
    }

    const altitude = req.body.altitude

    if(isNaN(altitude)){
        res.status(400).send('invalid altitude')
        return
    }

    const heading = req.body.heading

    if(isNaN(heading)){
        res.status(400).send('invalid heading')
        return
    }


    const pitch = req.body.pitch

    if(isNaN(pitch)){
        res.status(400).send('invalid pitch')
        return
    }

    // fov see https://www.bobatkins.com/photography/technical/field_of_view.html
    const fovVertical = req.body.fovVertical

    if(isNaN(fovVertical)){
        res.status(400).send('invalid fovVertical')
        return
    }

    const fovHorizontal = req.body.fovHorizontal

    if(isNaN(fovHorizontal)){
        res.status(400).send('invalid fovHorizontal')
        return
    }

    const timer = new Timer('calculateGroundCoverage').start()

    const coverage = await calculateGroundCoverage(lon, lat, altitude, heading, pitch, fovHorizontal, fovVertical, 0.1, 1000)

    timer.end()

    res.status(200).send({
        coverage
    })

}))


/**
 *
 * @param longitude
 * @param latitude
 * @param altitude in meters
 * @param bearing -180 to 180 (0 means north)
 * @param pitch -180 to 180 (zero means horizontal)
 * @param fovHorizontal in degrees
 * @param fovVertical  in degrees
 * @param quality 0-1
 * @param maxDistance in meters
 * @returns
 */
export async function calculateGroundCoverage(longitude: number, latitude: number, altitude: number, bearing: number, pitch: number, fovHorizontal: number, fovVertical: number, quality: number, maxDistance: number){

    const normalized = normalizePitchAndBearing(pitch, bearing)

    const rayCoverage = new RayCoverage(longitude, latitude, altitude, turf.degreesToRadians(normalized.bearing), turf.degreesToRadians(normalized.pitch), turf.degreesToRadians(fovHorizontal), turf.degreesToRadians(fovVertical))

    const startIsBelowTerrain = await rayCoverage.calculate(quality, maxDistance)

    if(startIsBelowTerrain){
        return false
    }

    return rayCoverage.extractData()
}


/**
 * allows input values to be > 180 or < -180
 *
 * @param pitch -180 to 180 (zero means horizontal)
 * @param bearing -180 to 180 (0 means north)
 * @returns pitch system changes to: -90 to 90 (zero means looking straight down)
 */
export function normalizePitchAndBearing(pitch: number, bearing: number){

    pitch -= 90

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

export default router
