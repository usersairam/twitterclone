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
       '${username}',
       '${name}',
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
      response.send(`JWT Token :${jwtToken}`);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
app.get("/user/tweets/feed/", authenticateUser, async (request, response) => {
  let { username } = request;
  let userIdQuery = `SELECT user_id from user where username = '${username}';`;
  let userId = await database.get(userIdQuery);
  const { user_id } = userId;
  let selectUserQuery = `SELECT distinct username, tweet,date_time AS dateTime
    FROM user join follower on user.user_id = following_user_id join tweet on
    following_user_id = tweet.user_id
    where follower_user_id=${user_id}
    order by date_time desc
    limit 4;`;
  let tweets = await database.all(selectUserQuery);
  response.send(tweets);
  console.log(username);
});
app.get("/user/following", authenticateUser, async (request, response) => {
  let { username } = request;
  let userIdQuery = `SELECT user_id from user where username = '${username}';`;
  let userId = await database.get(userIdQuery);
  const { user_id } = userId;
  let getFollowingList = `SELECT name from user join follower on user_id = following_user_id
    where follower_user_id = ${user_id};`;
  let following_list = await database.all(getFollowingList);
  response.send(following_list);
  console.log(user_id);
});
app.get("/user/followers/", authenticateUser, async (request, response) => {
  let { username } = request;
  let userIdQuery = `SELECT user_id from user where username = '${username}';`;
  let userId = await database.get(userIdQuery);
  const { user_id } = userId;
  let getFollowersListQuery = `SELECT name from user join follower
    on user.user_id = follower_user_id 
    where following_user_id = ${user_id};`;
  let followersList = await database.all(getFollowersListQuery);
  response.send(followersList);
});
app.get("/tweets/:tweetId/", authenticateUser, async (request, response) => {
  let { tweetId } = request.params;
  let { username } = request;
  let userIdQuery = `SELECT user_id from user where username = '${username}';`;
  let userId = await database.get(userIdQuery);
  const { user_id } = userId;
  let getFollowingList = `SELECT user_id AS follower_id from user join follower on user_id = following_user_id
    where follower_user_id = ${user_id};`;
  let following_list = await database.all(getFollowingList);
  let followersList = [];
  for (let each of following_list) {
    followersList.push(each.follower_id);
  }
  let tweetSelectedUserIdQuery = `SELECT user_id AS tweetedUser from tweet
  WHERE tweet_id = ${tweetId};`;
  let selectedUser = await database.get(tweetSelectedUserIdQuery);
  let { tweetedUser } = selectedUser;
  if (followersList.includes(tweetedUser)) {
    let likedTweetQuery = `select tweet, count(like.user_id) as likes,
    count(reply.user_id) as replies
    from tweet join like on tweet.tweet_id = like.tweet_id natural join reply  
    group by tweet.tweet_id
    having tweet.tweet_id=10;`;
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

module.exports = app;
