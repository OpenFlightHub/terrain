import { getAngleStepSizeForQuality, getCombinedAngle, getQualityValue, pointToLngLat } from '../../util/RayCoverage'
import * as turf from '@turf/turf'

describe('pointToLngLat()', ()=>{

    it('should work', ()=>{

        expect(pointToLngLat(turf.point([-13, 45]).geometry)).toEqual([-13, 45])
    })

})

describe('getCombinedAngle()', ()=>{

    it('should work', ()=>{

        const angle1 = turf.degreesToRadians(20)
        const angle2 = turf.degreesToRadians(30)

        expect(getCombinedAngle(angle1, angle2)).toEqual(turf.degreesToRadians(35))//TODO replace 35 with real result
    })

})

describe('getAngleStepSizeForQuality()', ()=>{

    it('should work with numbers without remainder (uneven)', ()=>{
        expect(getAngleStepSizeForQuality(0, turf.degreesToRadians(50))).toEqual(turf.degreesToRadians(10))
    })

    it('should work with numbers without remainder (even)', ()=>{
        expect(getAngleStepSizeForQuality(0, turf.degreesToRadians(40))).toEqual(turf.degreesToRadians(40/5))
    })

    it('should work with numbers with remainder (uneven)', ()=>{
        expect(getAngleStepSizeForQuality(0, turf.degreesToRadians(42))).toEqual(turf.degreesToRadians(42/5))
    })

    it('should work with numbers with remainder (even)', ()=>{
        expect(getAngleStepSizeForQuality(0, turf.degreesToRadians(38))).toEqual(turf.degreesToRadians(38/5))
    })

})



describe('getQualityValue()', ()=>{

    it('should work', ()=>{
        expect(getQualityValue(0, 0, 100)).toEqual(0)
        expect(getQualityValue(0.25, 0, 100)).toEqual(25)
        expect(getQualityValue(0.5, 0, 100)).toEqual(50)
        expect(getQualityValue(1, 0, 100)).toEqual(100)
    })

})
