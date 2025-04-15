import express from 'express';
import asyncHandler from 'express-async-handler'
import { calculateMaxLineOfSight } from '../util/lineOfSight'

const router = express.Router()


const GROUND_COVERAGE_TERRAIN_PRECISION = 50
const GROUND_COVERAGE_MAX_DISTANCE = 1000
const GROUND_COVERAGE_RAY_PRECISION = 0.1 // rays per degree


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

    const coverage = await calculateGroundCoverage(lon, lat, altitude, heading, pitch, fovHorizontal, fovVertical, GROUND_COVERAGE_RAY_PRECISION)

    res.status(200).send({
        coverage
    })

}))


// calculateGroundCoverage(
//     10.226762083333334,
//     47.561309861111106,
//     795.006,
//     37.8,
//     -89.9,
//     73.73979529168804,
//     53.13010235415598, GROUND_COVERAGE_RAY_PRECISION
// ).then(console.log)

/**
 *
 * @param fovHorizontal in degrees
 * @param fovVertical in degrees
 * @param precision in rays per degree fov
 */
async function calculateGroundCoverage(longitude: number, latitude: number, altitude: number, bearing: number, pitch: number, fovHorizontal: number, fovVertical: number, precision: number){

    type losPoint = Exclude<Awaited<ReturnType<typeof calculateMaxLineOfSight>>, false>

    const outerLosPoints: losPoint[] = []
    const allLospoints: losPoint[] = []

    const stepSize = 1/precision


    for(let h = 0; h <= fovHorizontal; h+= stepSize){
        const bearingTotal = bearing - fovHorizontal/2 + h

        for(let v = 0; v <= fovVertical; v+= stepSize){

            const pitchTotal = pitch - fovVertical/2 + v

            const los = await calculateMaxLineOfSight(longitude, latitude, altitude, bearingTotal, pitchTotal, GROUND_COVERAGE_TERRAIN_PRECISION, GROUND_COVERAGE_MAX_DISTANCE)

            if(los !== false){
                allLospoints.push(los)

                if(h === 0 || h === fovHorizontal || v === 0 || v === fovVertical){
                    outerLosPoints.push(los)
                }
            }
        }
    }

    return {
        outer: outerLosPoints,
        all: allLospoints
    }
}

export default router
