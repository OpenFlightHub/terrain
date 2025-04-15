import {normalizePitchAndBearing} from '../../util/lineOfSight'

describe('normalizePitchAndBearing', ()=>{

    it('should not touch pitch > -90 and < 90', ()=>{

        expect(normalizePitchAndBearing(50, 90)).toEqual({
            pitch: 50,
            bearing: 90
        })

        expect(normalizePitchAndBearing(-50, 90)).toEqual({
            pitch: -50,
            bearing: 90
        })

    })

    it('should fix pitch of 90', ()=>{

        expect(normalizePitchAndBearing(90, 90)).toEqual({
            pitch: 89.9,
            bearing: 90
        })

    })

    it('should fix pitch of -90', ()=>{

        expect(normalizePitchAndBearing(-90, 90)).toEqual({
            pitch: -89.9,
            bearing: 90
        })

    })


    it('should fix pitch of > 90 and flip bearing', ()=>{

        expect(normalizePitchAndBearing(110, 0)).toEqual({
            pitch: 70,
            bearing: 180
        })

    })

    it('should fix pitch of < -90 and flip bearing', ()=>{

        expect(normalizePitchAndBearing(-110, 0)).toEqual({
            pitch: -70,
            bearing: 180
        })

    })

})
