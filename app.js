const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const validatePassword = (password) => {
  return password.length > 6;
};
const authenticateUser = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "sairam", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};
app.post("/register", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const databaseUser = await database.get(selectUserQuery);

  if (databaseUser === undefined) {
    const createUserQuery = `
     INSERT INTO
      user (username, name, password, gender)
     VALUES
      (
       '${name}',
       '${username}',
       '${hashedPassword}',
       '${gender}' 
      );`;
    if (validatePassword(password)) {
      await database.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  let getUserQuery = `SELECT * FROM user where username = '${username}';`;
  let isUser = await database.get(getUserQuery);
  if (isUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, isUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "sairam");
      response.send(jwtToken);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
app.get("/user/tweets/feed/", authenticateUser, async (request, response) => {
  let { username } = request;
  const userIdQuery = `SELECT user_id from user where username = '${username}';`;
  let userId = await database.get(userIdQuery);
  let selectUserQuery = `SELECT distinct username, tweet,date_time AS dateTime
    FROM user JOIN follower on user.user_id = follower_user_id join tweet on 
    follower_user_id = tweet.user_id
    order by date_time desc
    limit 4;`;
  let tweets = await database.all(selectUserQuery);
  response.send(tweets);
});
module.exports = app;
