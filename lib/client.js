const mchat = require('motechat')
const os = require('os')
const low = require('lowdb')
const Memory = require('lowdb/adapters/Memory')

const isOpen = db => new Promise(resolve => {
    mchat.Open(
        db.get('config').value(),
        result => resolve(result.ErrCode == 0)
    )
})

const isReg = db => new Promise(resolve => {
    mchat.Reg(
        db.get('dSIM').value(),
        result => resolve(result)
    )
})

const updateDevice = (db, result) => {
    let dSIM = db.get('dSIM').value()
    if (dSIM.SToken != result.SToken || dSIM.EiToken != result.EiToken) {
        db.set('dSIM.SToken', result.SToken)
            .set('dSIM.EiToken', result.EiToken)
            .write()
    }
}

const setEiInfo = (db, DDN) => new Promise(resolve => {
    let dSIM = db.get('dSIM').value()
    let mote = db.get('mote').value()
    let config = db.get('config').value()

    mchat.Set({
        SToken: dSIM.SToken,
        EdgeInfo: {
            DDN,
            EiOwner: mote.EiOwner,
            EiName: mote.EiName,
            EiType: mote.EiType,
            EiTag: mote.EiTag,
            EiLoc: mote.EiLoc
        }
    }, reply => {
        console.log('EiInfo setting: ', reply)
        resolve(
            db.set('DDN', DDN)
                .set('mote', mote)
                .set('dSIM', dSIM)
                .set('config', config)
                .write()
        )
    })
})

const getMessage = (db, { Topic = '', DDN = '', Data } = {}) => ({
    SToken: db.get('dSIM.SToken'),
    DDN, Topic, Data,
    SendTimeout: 6,
    WaitReply: 12
})

const getRPC = (db, { Topic = '', DDN = '', Func, Data } = {}) => ({
    SToken: db.get('dSIM.SToken'),
    DDN, Topic, Func, Data
})


const client = {
    init: async () => {
        this.db = low(new Memory())
        let settings = this.db.defaults({
            DDN: "",
            mote: {
                EiOwner: "",
                EiName: os.hostname(),
                EiType: ".mms",
                EiTag: "#mms",
                EiLoc: ""
            },
            dSIM: { SToken: "", EiToken: "" },
            config: {
                AppName: "rtu",
                AppKey: "1u6WauSf",
                DCenter: process.env.DC || "dc@dc.ypcloud.com:6789",
                MotebusGW: process.env.MOTEBUS_GATEWAY || "127.0.0.1",
                IOC: process.env.IOC || "",
                UseWeb: "",
                WebPort: "",
                WebEntry: ""
            }
        }).write()

        console.log(settings)
        console.log("ENV DC:", process.env.DC)

        if (!await isOpen(this.db)) {
            throw new Error('motechat not open')
        }

        let regData = await isReg(this.db)
        console.log('regData: ', regData)

        if (regData.ErrCode != 0) {
            throw new Error('motechat reg fail')
        }

        updateDevice(this.db, regData.result)
        setEiInfo(this.db, regData.result.DDN)
    },

    send: (topic, DDN, payload) => new Promise(resolve => {
        let message = getMessage(this.db, {
            Topic: topic, DDN, Data: payload
        })

        mchat.Send(message, reply => resolve(reply))
    }),

    call: (topic, DDN, func, payload = {}) => new Promise(resolve => {
        let xrpc = getRPC(this.db, {
            Topic: topic, DDN, Func: func, Data: payload
        })

        mchat.Call(xrpc, reply => resolve(reply))
    }),

    getDDN: () => this.db.get('DDN').value(),
    on: callback => mchat.OnEvent('message', callback, '')
}

module.exports = client