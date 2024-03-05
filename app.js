const express = require('express')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at http://localhost:3000/')
    })
  } catch (e) {
    console.log(`DB Error: ${e.message}`)
    process.exit(1)
  }
}

initializeDBAndServer()

//loginuser
app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    console.log(dbUser)
    console.log(dbUser.password)
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatched === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'ABC@123')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

//
const convertdbintocamelcase = eachobj => {
  return {
    stateId: eachobj.state_id,
    stateName: eachobj.state_name,
    population: eachobj.population,
  }
}

//
const convertdistrictdbintocamelcase = eachobj => {
  return {
    districtId: eachobj.district_id,
    districtName: eachobj.district_name,
    stateId: eachobj.state_id,
    cases: eachobj.cases,
    cured: eachobj.cured,
    active: eachobj.active,
    deaths: eachobj.deaths,
  }
}

//authenticateToken
const authenticateToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']

  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
    if (jwtToken === undefined) {
      response.status(401)
      response.send('Invalid JWT Token')
    } else {
      jwt.verify(jwtToken, 'ABC@123', async (error, payload) => {
        if (error) {
          response.status(401)
          response.send('Invalid JWT Token')
        } else {
          request.username = payload.username
          next()
        }
      })
    }
  }
}

//getallstates
app.get('/states/', authenticateToken, async (request, response) => {
  const {username} = request
  const getallstatesquery = `
    SELECT
        *
    FROM state
    ORDER BY state_id;`

  const states = await db.all(getallstatesquery)
  response.send(
    states.map(dbobj => {
      return convertdbintocamelcase(dbobj)
    }),
  )
})

//getStatebasedon stateId
app.get('/states/:stateId/', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getastatequery = `SELECT 
    * 
  FROM 
    state
  WHERE 
    state_id= ${stateId};`

  const state = await db.get(getastatequery)

  response.send(convertdbintocamelcase(state))
})

//Create a district
app.post('/districts/', authenticateToken, async (request, response) => {
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const cratedistrictquery = `INSERT INTO district (district_name, state_id,cases,cured,active,deaths)
    VALUES("${districtName}", ${stateId},${cases},${cured},${active},${deaths});`

  await db.run(cratedistrictquery)

  response.send('District Successfully Added')
})

//getdistrict
app.get(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getadistrictquery = `SELECT 
    * 
  FROM 
    district
  WHERE district_id= ${districtId};`

    const districtresult = await db.get(getadistrictquery)

    response.send(convertdistrictdbintocamelcase(districtresult))
  },
)

//deletedistrict
app.delete(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params

    const deletedistrictquery = `DELETE FROM district WHERE district_id=${districtId};`

    await db.run(deletedistrictquery)
    response.send('District Removed')
  },
)

//UPDATEdistrict
app.put(
  '/districts/:districtId/',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body

    const updatedisquery = `
  UPDATE 
    district 
  SET 
    district_name="${districtName}",
    state_id=${stateId},
    cases=${cases},
    cured=${cured},
    active=${active},
    deaths=${deaths} 
  WHERE 
    district_id=${districtId};   
  `
    await db.run(updatedisquery)
    response.send('District Details Updated')
  },
)

//getstatestats
app.get(
  '/states/:stateId/stats/',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getadistrictquery = `SELECT 
    * 
  FROM 
    district
  WHERE 
    state_id= ${stateId};`

    const districtresult = await db.all(getadistrictquery)

    let totalCases = 0
    let totalCured = 0
    let totalActive = 0
    let totalDeaths = 0

    for (let eachobj of districtresult) {
      ;(totalCases += eachobj.cases),
        (totalCured += eachobj.cured),
        (totalActive += eachobj.active),
        (totalDeaths += eachobj.deaths)
    }

    response.send({
      totalCases: totalCases,
      totalCured: totalCured,
      totalActive: totalActive,
      totalDeaths: totalDeaths,
    })
  },
)

module.exports = app
