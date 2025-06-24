import * as turf from '@turf/turf'
import { getElevation } from '../util/hgt';
import { Point } from 'geojson';

const MAX_TERRAIN_ELEVATION_POSSIBLE = 9000 // Mt. Everest 8848m

/**
 * Units: radians and meters (exception: longitude and latitude use degree)
 */

export default class RayCoverage {

    readonly startPosition: LngLat
    readonly startAltitude: number
    readonly startPitch: number
    readonly startYaw: number
    readonly fovYaw: number
    readonly fovPitch: number

    private rayLevels?: Array<RayLevel> | undefined

    constructor(startLongitude: number, startLatitude: number, startAltitude: number, startYaw: number, startPitch: number, fovYaw: number, fovPitch: number){
        this.startPosition = [startLongitude, startLatitude]
        this.startAltitude = startAltitude
        this.startYaw = startYaw
        this.startPitch = startPitch
        this.fovYaw = fovYaw
        this.fovPitch = fovPitch
    }

    /**
     *
     * @param quality 0 - 1 (0 = lowest possible, 1 = highest possible)
     * @param maxDistance
     * @returns false if start position is below terrain
     */
    async calculate(quality: number, maxDistance: number){

        const startTerrainElevation = await getElevation(this.startPosition[0], this.startPosition[1])
        if(this.startAltitude < startTerrainElevation){
            return false
        }

        this.rayLevels = new Array<RayLevel>()

        let previousRayLevel: RayLevel | undefined

        let steps = 1

        do{
            const currentDistance = (steps ** 2) * getQualityValue(quality, 100, 1)

            if(currentDistance > maxDistance){
                break
            }

            const level = new RayLevel(this, currentDistance, previousRayLevel)

            this.rayLevels.push(level)

            await level.calculate(quality)// TODO can we optimize RAM usage by throwing away the previous previous ray level?

            previousRayLevel = level
            steps++

        } while(true)
    }

    extractData(){

        if(typeof this.rayLevels === 'undefined'){
            throw new Error('not calculated yet')
        }

        const data =  this.rayLevels[this.rayLevels.length - 1].extractData()

        return convertRayCoverageDataToCoverageAreas(data)
    }
}

export class RayLevel {

    readonly coverage: RayCoverage
    readonly distanceFromStart: number
    readonly previousRayLevel?: RayLevel

    private rayPoints: Array<Array<RayPoint>> | undefined

    constructor(coverage: RayCoverage, distanceFromStart: number, previousRayLevel?: RayLevel){
        this.coverage = coverage
        this.distanceFromStart = distanceFromStart
        this.previousRayLevel = previousRayLevel
    }

    /**
     *
     * @param quality 0 - 1 (0 = lowest possible, 1 = highest possible)
     */
    async calculate(quality: number){

        const yawSteps = getAngleStepsForQuality(quality, this.coverage.fovYaw)
        const pitchSteps = getAngleStepsForQuality(quality, this.coverage.fovPitch)

        this.rayPoints = []

        for(const yawStep of yawSteps.steps){
            this.rayPoints[yawStep.index] = []

            for(const pitchStep of pitchSteps.steps){
                this.rayPoints[yawStep.index][pitchStep.index] = new RayPoint(this, yawStep, pitchStep)
            }
        }

        for(const rayPointRow of this.rayPoints){
            for(const rayPoint of rayPointRow){
                await rayPoint.calculate(quality)
            }
        }
    }

    getClosestRayPointForAngles(quality: number, yaw: number, pitch: number){

        if(!this.rayPoints){
            throw new Error('not calculated yet')
        }

        const yawStep = getClosestAngleStepForAngle(quality, yaw, this.coverage.fovYaw)
        const pitchStep = getClosestAngleStepForAngle(quality, pitch, this.coverage.fovPitch)

        return this.rayPoints[yawStep.index][pitchStep.index]
    }

    extractData(){

        if(!this.rayPoints){
            throw new Error('not calculated yet')
        }

        return this.rayPoints.map(rayPointRow => rayPointRow.map(rayPoint => {
            return {
                isBelowTerrain: rayPoint.rayIsBelowTerrain(),
                targetLocation: rayPoint.getTargetLocation()
            }
        }))
    }
}

type AngleSteps = {
    stepSize: number // in radians
    steps: AngleStep[]
}

type AngleStep = {
    index: number
    value: number // in radians
}

/**
 *
 * @returns stepSize so that stepCount is always uneven
 */
export function getAngleStepSizeForQuality(quality: number, totalFov: number){

    const minStepSize = getQualityValue(quality, turf.degreesToRadians(10), turf.degreesToRadians(0.01))

    let stepCount = Math.ceil(totalFov / minStepSize)

    // enforce uneven step count
    if(stepCount % 2 === 0){
        stepCount++
    }

    return totalFov / stepCount
}

/**
 *
 * @returns stepCount is always uneven!
 */
export function getAngleStepsForQuality(quality: number, totalFov: number): AngleSteps{

    const stepSize = getAngleStepSizeForQuality(quality, totalFov)

    const stepCount = totalFov / stepSize

    const steps = new Array<AngleStep>

    for(let i = 0; i < stepCount; i++){
        steps.push({
            index: i,
            value: stepSize * i
        })
    }

    return {
        stepSize,
        steps
    }
}

export function getClosestAngleStepForAngle(quality: number, angle: number, totalFov: number): AngleStep {

    const normalizedAngle = angle + totalFov/2

    const stepSize = getAngleStepSizeForQuality(quality, totalFov)

    const steps = Math.round(normalizedAngle / stepSize)

    return {
        index: steps,
        value: steps * stepSize
    }
}

type LngLat = [number, number]

export class RayPoint {

    readonly level: RayLevel
    readonly yawDegreeStep: AngleStep
    readonly pitchDegreeStep: AngleStep

    private isBelowTerrain?: boolean
    private previousLevelRayPoint?: RayPoint | undefined // if raypoint of previous level is already below terrain, then that raypoint is referenced here
    private targetLocation?: LngLat

    constructor(level: RayLevel, yawDegreeStep: AngleStep, pitchDegreeStep: AngleStep){
        this.level = level
        this.yawDegreeStep = yawDegreeStep
        this.pitchDegreeStep = pitchDegreeStep
    }


    /**
     *
     * @param quality 0 - 1 (0 = lowest possible, 1 = highest possible)
     */
    async calculate(quality: number){

        const direction = {
            yaw: this.level.coverage.startYaw - this.level.coverage.fovYaw/2 + this.yawDegreeStep.value,
            pitch: this.level.coverage.startPitch - this.level.coverage.fovPitch/2 + this.pitchDegreeStep.value
        }

        if(this.level.previousRayLevel){

            const rayPoint = this.level.previousRayLevel.getClosestRayPointForAngles(quality, direction.yaw, direction.pitch)

            if(rayPoint.rayIsBelowTerrain()){
                this.isBelowTerrain = true
                this.previousLevelRayPoint = rayPoint
                return
            }
        }

        const combinedAngle = getCombinedAngle(direction.yaw, direction.pitch)

        const altitude = this.level.coverage.startAltitude - Math.cos(combinedAngle) * this.level.distanceFromStart

        const distanceOnGround = Math.sin(combinedAngle) * this.level.distanceFromStart
        //TODO implement bending effect of earth?

        if(altitude > MAX_TERRAIN_ELEVATION_POSSIBLE){
            this.isBelowTerrain = false
            return
        }

        this.targetLocation = pointToLngLat(turf.destination(this.level.coverage.startPosition, distanceOnGround, direction.yaw, {units: 'meters'}).geometry)

        const terrainElevation = await getElevation(this.targetLocation[0], this.targetLocation[1])//TODO implement quality based averaging of surrounding terrain

        this.isBelowTerrain = altitude < terrainElevation
    }

    rayIsBelowTerrain(){

        if(typeof this.isBelowTerrain == 'undefined'){
            throw new Error('not calculated yet')
        }

        return this.isBelowTerrain
    }

    // undefined means: is infinite (sky)
    getTargetLocation(): LngLat | undefined {

        if(typeof this.isBelowTerrain == 'undefined'){
            throw new Error('not calculated yet')
        }


        if(typeof this.previousLevelRayPoint !== 'undefined'){
            return this.previousLevelRayPoint.getTargetLocation()
        }

        return this.targetLocation
    }
}


export function getQualityValue(quality: number, minPossible: number, maxPossible: number){
    return Math.max(0, Math.min(1, quality)) * (maxPossible - minPossible) + minPossible
}

export function getCombinedAngle(angle1: number, angle2: number){

    const angle1Length = /* 1 * */ Math.tan(angle1)
    const angle2Length = /* 1 * */ Math.tan(angle2)

    const combinedLength = Math.sqrt(angle1Length**2 + angle2Length**2)

    return /* 1 * */ Math.atan(combinedLength)
}

export function pointToLngLat(point: Point){
    return point.coordinates as LngLat
}

type CoverageArea = {
    visible: boolean
    border: LngLat[]
}

export function convertRayCoverageDataToCoverageAreas(rayCoverageData: ReturnType<RayLevel["extractData"]>){
    const areas = new Array<CoverageArea>()

    const totalIndexesYaw = rayCoverageData.length
    const totalIndexesPitch = rayCoverageData[0].length

    const centerIndexYaw = Math.round(totalIndexesYaw / 2 + 0.5)
    const centerIndexPitch = Math.round(totalIndexesPitch / 2 + 0.5)

    const sideIndexesYaw = totalIndexesYaw - centerIndexYaw
    const sideIndexesPitch = totalIndexesPitch - centerIndexPitch

    // top right
    process(+1, +1)
    // bottom right
    process(+1, -1)
    // bottom left
    process(-1, -1)
    // top left
    process(-1, -1)

    function process(yawIndexDir: number, pitchIndexDir: number){
        for(let y = 1; y < sideIndexesYaw; y++){
            const indexYaw = centerIndexYaw + y * yawIndexDir

            for(let p = 1; p < sideIndexesPitch; p++){
                const indexPitch = centerIndexPitch + p * pitchIndexDir

                const box = rayCoverageData[indexYaw][indexPitch]

                if(typeof box.targetLocation === 'undefined'){
                    //sky, ignore
                    continue
                }

                const point1 = rayCoverageData[indexYaw - yawIndexDir]?.[indexPitch - pitchIndexDir]
                const point2 = rayCoverageData[indexYaw]?.[indexPitch - pitchIndexDir]
                const point3 = rayCoverageData[indexYaw - yawIndexDir]?.[indexPitch]

                if(typeof point1.targetLocation === 'undefined' || typeof point2.targetLocation  === 'undefined' || typeof point3.targetLocation === 'undefined' ){
                    //this should not happen

                    console.log('this should not happen')

                    continue
                }

                areas.push({
                    visible: !box.isBelowTerrain,
                    border: [
                        point1.targetLocation,
                        point2.targetLocation,
                        point3.targetLocation,
                        box.targetLocation
                    ]
                })
            }

        }
    }

    return areas
}
