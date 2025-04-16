import express from 'express';
import asyncHandler from 'express-async-handler'
import { calculateLineOfSight, calculateMaxLineOfSight, isTerrainBetweenUsingAltitude, isTerrainBetweenUsingPitch } from '../util/lineOfSight'
import * as turf from '@turf/turf'
import { getElevation } from '../util/hgt';
import Timer from '../util/timer'

const router = express.Router()


const GROUND_COVERAGE_TERRAIN_PRECISION = 50
const GROUND_COVERAGE_MAX_DISTANCE = 1000 * 10
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

    const coverage = await calculateGroundCoverage(lon, lat, altitude, heading, pitch, fovHorizontal, fovVertical, GROUND_COVERAGE_RAY_PRECISION)

    timer.end()

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

    type losPoint = {
        position: {
            longitude: number
            latitude: number
        },
        elevation: number
        debug?: string
    }

    const allLosPoints: losPoint[] = []

    const stepSize = 1/precision

    const stepsHorizontal = Math.ceil(fovHorizontal / stepSize)
    const stepsVertical = Math.ceil(fovVertical / stepSize)

    const map: (losPoint | false)[][] = new Array(stepsHorizontal + 1)


    const timerMaxLineOfSight = new Timer('MaxLineOfSight').start()


    for(let hi = 0; hi <= stepsHorizontal; hi++){
        map[hi] = new Array(stepsVertical + 1)

        const bearingTotal = bearing - fovHorizontal/2 + (hi * stepSize)

        let lastLosDistance: number

        for(let vi = 0; vi <= stepsVertical; vi++){

            const pitchTotal = pitch - fovVertical/2 + (vi * stepSize) + pitchCorrection(hi * stepSize - fovHorizontal/2)

            const los = await calculateMaxLineOfSight(longitude, latitude, altitude, bearingTotal, pitchTotal, GROUND_COVERAGE_TERRAIN_PRECISION, GROUND_COVERAGE_MAX_DISTANCE, typeof lastLosDistance === 'number' ? lastLosDistance : undefined)//because of how the terrain model works, we can assume, that given the previous max line of sight, we can kind of start looking for terrain from there

            if(los !== false){
                allLosPoints.push(los)
                lastLosDistance = los.directDistance
            } else {
                const directLos = calculateLineOfSight(longitude, latitude, altitude, bearingTotal, pitchTotal, GROUND_COVERAGE_MAX_DISTANCE) as losPoint
                directLos.debug = 'failed'

                allLosPoints.push(directLos)
            }

            map[hi][vi] = los
        }
    }

    timerMaxLineOfSight.end()

    const timerHoles = new Timer('holes').start()

    type hole = {membersStart: {hi: number, vi: number}[], membersEnd: {hi: number, vi: number}[]}
    const holes: hole[] = []

    for(let hi = 0; hi < map.length; hi++){

        let lastRatio: number

        for(let vi = 0; vi < map[0].length; vi++){
            const m = map[hi][vi]

            if(m !== false){

                let last: losPoint | false
                let lastVi: number

                for(let i = vi-1; i >= 0; i--){
                    last = map[hi][i] // is looking further down

                    if(last){
                        lastVi = i
                        break
                    }
                }

                if(last){

                    const distanceBetweenMandLast = turf.distance([m.position.longitude, m.position.latitude], [last.position.longitude, last.position.latitude], {
                        units: 'meters'
                    })

                    const ratio = (m.elevation - last.elevation) / distanceBetweenMandLast

                    if(typeof lastRatio === 'number'){

                        if(ratio < lastRatio){
                            // a downwards dent

                            const center = turf.midpoint([m.position.longitude, m.position.latitude], [last.position.longitude, last.position.latitude])
                            const centerElevation = await getElevation(center.geometry.coordinates[0], center.geometry.coordinates[1])

                            const terrainBetween = await isTerrainBetweenUsingAltitude(center.geometry.coordinates[0], center.geometry.coordinates[1], centerElevation, longitude, latitude, altitude, GROUND_COVERAGE_TERRAIN_PRECISION)

                            if(terrainBetween){
                                // actual hole

                                last.debug = 'hole-start'
                                m.debug = 'hole-end'

                                let foundExistingHole = false

                                for(const hole of holes){

                                    if(hole.membersStart.find(m => Math.abs(m.vi - vi) <= 1 && Math.abs(m.hi - hi) <= /* TODO === or <= ? */ 1)){
                                        hole.membersStart.push({hi, vi})
                                        hole.membersEnd.push({hi, vi: lastVi})
                                        foundExistingHole = true
                                        break
                                    }
                                }

                                if(!foundExistingHole){
                                    holes.push({
                                        membersStart: [{hi, vi}],
                                        membersEnd: [{hi, vi: lastVi}]
                                    })
                                }
                            }
                        }
                    }

                    lastRatio = ratio
                }
            }
        }
    }

    timerHoles.end()


    const timerOuter = new Timer('outerLosPoints').start()

    const outerLosPointsLow: losPoint[] = []
    const outerLosPointsHigh: losPoint[] = []


    for(let hi = 0; hi < map.length; hi++){

        let highestVi = -1
        let lowestVi = map.length

        for(let vi = 0; vi < map[0].length; vi++){
            if(map[hi][vi]){
                if(vi > highestVi){
                    highestVi = vi
                }

                if(vi < lowestVi){
                    lowestVi = vi
                }
            }
        }

        if(lowestVi !== map.length){
            outerLosPointsLow.push(map[hi][lowestVi] as losPoint)
        }

        if(highestVi !== -1){
            outerLosPointsHigh.push(map[hi][highestVi] as losPoint)
        }
    }

    timerOuter.end()

    const timerSimplifyHoleAreas = new Timer('simplify hole ares').start()

    const simplifiedHoleAreas: losPoint[][] = []

    for(const hole of holes){

        const positions = hole.membersStart.concat(hole.membersEnd.reverse()).map(m => {
            const p = map[m.hi][m.vi] as losPoint

            return [p.position.longitude, p.position.latitude]
        })

        if(positions.length < 3){
            continue
        }

        const distancesToNext: number[] = []

        // fix single spikes that are very long
        for(let pi = 0; pi < positions.length - 1; pi++){
            const current = positions[pi]
            const next = positions[pi + 1]

            distancesToNext.push(turf.distance(current, next, {units: 'meters'}))
        }
        distancesToNext.push(turf.distance(positions[positions.length - 1], positions[0]))

        for(let pi = 0; pi < positions.length; pi++){
            const distanceToPrevious = distancesToNext[pi-1]
            const distanceToNext = distancesToNext[pi]

            const posPrevious = positions[pi === 0 ? (positions.length - 1) : (pi-1)]
            const posNext = positions[(pi === positions.length - 1) ? 0 : pi+1]

            const distanceBetweenLastAndNext = turf.distance(
                posPrevious,
                posNext
            )

            const spikeDistanceThreshold = distanceBetweenLastAndNext * 5

            if(distanceToPrevious > spikeDistanceThreshold && distanceToNext > spikeDistanceThreshold){
                distancesToNext.splice(pi-1, 2, turf.distance(posPrevious, posNext))
                positions.splice(pi, 1)
                pi--
            }
        }


        const simplified = turf.simplify(turf.lineString(positions), {
            highQuality: true,
            tolerance: 0.0005 // unit degrees?
        })

        const holePoints: losPoint[] = []

        for(const c of simplified.geometry.coordinates){
            holePoints.push({
                position: {
                    longitude: c[0],
                    latitude: c[1]
                },
                elevation: await getElevation(c[0], c[1])
            })
        }

        console.log('simplified', positions.length, 'to', holePoints.length)

        simplifiedHoleAreas.push(holePoints)
    }

    timerSimplifyHoleAreas.end()


    return {
        all: allLosPoints,
        outer: outerLosPointsLow.concat(outerLosPointsHigh.reverse()),
        holes: simplifiedHoleAreas
    }
}

//TODO actually this a problem for all directions. pitch must incrase if bearing increases, the top left corner must have way more pitch then the top conter of an image (field of view)

// fixes the bending at the bottom
function pitchCorrection(bearing: number){
    const bearingDelta = Math.abs(bearing)

    return 0 //bearingDelta**1.75 / 100
}

export default router
