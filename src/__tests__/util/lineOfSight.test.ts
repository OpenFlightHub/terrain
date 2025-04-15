import {normalizePitchAndBearing} from '../../util/lineOfSight'

describe('normalizePitchAndBearing', ()=>{

    it('should return correct results', async()=>{

        expect(normalizePitchAndBearing(45, 90)).toEqual({
            pitch: 45,
            bearing: 90
        })

        expect(normalizePitchAndBearing(-45, 90)).toEqual({
            pitch: -45,
            bearing: 90
        })

        expect(normalizePitchAndBearing(90, 90)).toEqual({
            pitch: 89.9,
            bearing: 90
        })

        expect(normalizePitchAndBearing(-90, 90)).toEqual({
            pitch: -89.9,
            bearing: 90
        })

        expect(normalizePitchAndBearing(110, 90)).toEqual({
            pitch: 70,
            bearing: 270
        })

        expect(normalizePitchAndBearing(-110, 90)).toEqual({
            pitch: -70,
            bearing: 270
        })
    })

})
