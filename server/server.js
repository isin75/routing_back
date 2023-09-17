import express from 'express'
import path from 'path'
import cors from 'cors'
import sockjs from 'sockjs'
import cookieParser from 'cookie-parser'
import axios from 'axios'

import config from './config'
import Html from '../client/html'

const { readFile, writeFile, unlink } = require("fs").promises


require('colors')

let connections = []

const port = process.env.PORT || 8090
const server = express()

const getUsers = async () => {
  try {
    const text = await readFile(`${__dirname}/data/users.json`, { encoding: 'utf8' });
    return JSON.parse(text);
  } catch (error) {
    const url = 'https://jsonplaceholder.typicode.com/users';
    const { data } = await axios(url);
    await writeFile(`${__dirname}/data/users.json`, JSON.stringify(data), { encoding: 'utf8' });
    return data;
  }
}

const addUser = async (newDataInList) => {
    await writeFile(`${__dirname}/data/users.json`, JSON.stringify(newDataInList), { encoding: 'utf8' })
} 

const headers = (req, res, next) => {
  res.set('x-skillcrucial-user', '94817793-1099-40ca-99f6-b2a89a35ed74');  
  res.set('Access-Control-Expose-Headers', 'X-SKILLCRUCIAL-USER')  
  next()
}

const middleware = [
  cors(),
  express.static(path.resolve(__dirname, '../dist')),
  express.urlencoded({ limit: '50mb', extended: true, parameterLimit: 50000 }),
  express.json({ limit: '50mb', extended: true }),
  cookieParser(),
  headers
]

middleware.forEach((it) => server.use(it))

server.get('/', (req, res) => {
  res.send(`
    <h2>This is SkillCrucial Express Server!</h2>
    <h3>Client hosted at <a href="http://localhost:8087">localhost:8087</a>!</h3>
  `)
})

server.get('/api/v1/users', async (req, res) => {
  try {
    const users = await getUsers()
      res.json(users)
  } catch (error) {
      res.status(500).json({ status: 'error', message: 'Internal Server Error' })
  }
})

server.post('/api/v1/users', async (req, res) => {
  try {
    const users = await getUsers()
    const newUserData = req.body
    const newId = users[users.length - 1].id + 1
    const newUser = { id: newId, ...newUserData }
    const newUserList = [...users, newUser]
    await addUser(newUserList)
    res.status(201).json({ status: 'success', id: newId })
  } catch (error) {
      res.status(500).json({ status: 'error', message: 'Internal Server Error' })
  }
})

server.patch('/api/v1/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params
    const newUserValue = req.body
    const users = await getUsers()
    const updateUser = users.map((user) => {
      if (user.id === +userId) {
        return { ...user, ...newUserValue}
     }
      return user
    })
    await addUser(updateUser)
    res.json({ status: 'success', id: userId })
  } catch (error) {
      res.status(500).json({ status: 'error', message: 'Internal Server Error' })
  }
})

server.delete('/api/v1/users/:userIdToDelete', async (req, res) => {
  try {
    const { userIdToDelete } = req.params;
    const users = await getUsers()

    const updatedUsers = users.filter((user) => user.id !== +userIdToDelete);
    
    await addUser(updatedUsers)
    
    res.json({ status: 'success', id: userIdToDelete });
  } catch (error) {
      res.status(500).json({ status: 'error', message: 'Internal Server Error' })
  }
})

server.delete('/api/v1/users', (req, res) => {
  unlink(`${__dirname}/data/users.json`)
  res.json({ status: 'deleted' })
})

server.get('/*', (req, res) => {
  const initialState = {
    location: req.url
  }

  return res.send(
    Html({
      body: '',
      initialState
    })
  )
})

server.use('/api/', (req, res) => {
  res.status(404)
  res.end()
})

const app = server.listen(port)

if (config.isSocketsEnabled) {
  const echo = sockjs.createServer()
  echo.on('connection', (conn) => {
    connections.push(conn)
    conn.on('data', async () => {})

    conn.on('close', () => {
      connections = connections.filter((c) => c.readyState !== 3)
    })
  })
  echo.installHandlers(app, { prefix: '/ws' })
}
console.log(`Serving at http://localhost:${port}`)
