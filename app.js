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
const getResponseObject = (object) => {
  return object.username;
};

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
      let responseObject = {
        jwtToken: `${jwtToken}`,
      };
      response.send(responseObject);
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
  let responseObjectList = [];
  for (let each of tweets) {
    let responseObject = {
      username: `${each.username}`,
      tweet: `${each.tweet}`,
      dateTime: `${each.dateTime}`,
    };
    responseObjectList.push(responseObject);
  }
  response.send(tweets);
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
    let likedTweetQuery = `select tweet ,date_time as dateTime 
    from tweet where tweet_id = ${tweetId};`;
    let likesQuery = `select count(user_id) as likes 
    from like where tweet_id = ${tweetId};`;
    let repliesQuery = `select count(user_id) as replies
    from reply where tweet_id = ${tweetId};`;
    let likedTweet = await database.get(likedTweetQuery);
    let likesCount = await database.get(likesQuery);
    let repliesCount = await database.get(repliesQuery);
    const { tweet, dateTime } = likedTweet;
    const { likes } = likesCount;
    const { replies } = repliesCount;
    let responseObject = {
      tweet: `${tweet}`,
      likes: `${likes}`,
      replies: `${replies}`,
      dateTime: `${dateTime}`,
    };
    response.send(responseObject);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
app.get(
  "/tweets/:tweetId/likes/",
  authenticateUser,
  async (request, response) => {
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
      let likedUserQuery = `SELECT username from user natural join
        like 
        where tweet_id = ${tweetId};`;
      let likedUser = await database.all(likedUserQuery);
      let responseObject = {
        likes: likedUser.map((each) => each.username),
      };
      response.send(responseObject);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get(
  "/tweets/:tweetId/replies/",
  authenticateUser,
  async (request, response) => {
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
      let nameQuery = `select name,reply from user 
      natural join tweet natural join reply where tweet_id = ${tweetId};`;

      let repliedName = await database.all(nameQuery);

      let responseObject = {
        replies: repliedName,
      };
      response.send(responseObject);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);
app.get("/user/tweets/", authenticateUser, async (request, response) => {
  let { username } = request;
  let userIdQuery = `SELECT user_id from user where username = '${username}';`;
  let userId = await database.get(userIdQuery);
  const { user_id } = userId;
  let tweetsQuery = `select tweet,date_time,tweet_id 
    from tweet 
    where user_id= ${user_id};`;
  let tweets = await database.all(tweetsQuery);
  let repliesCountQuery = `select count(user_id) as replies from reply where tweet_id = ${user_id};`;
  let likesCountQuery = `select count(user_id) as likes from like where tweet_id = ${user_id};`;
  let repliesCount = await database.all(repliesCountQuery);
  let likesCount = await database.all(likesCountQuery);
  for (let each of tweets) {
    console.log(each.tweet);
  }

  //   let responseObject = {
  //     tweet: tweets.map((each) => each.tweet),
  //     likes: likesCount.map((each) => each.likes),
  //     replies: repliesCount.map((each) => each.replies),
  //     dateTime: tweets.map((each) => each.date_time),
  //   };
  //   response.send(responseObject);
});
app.post("/user/tweets/", authenticateUser, async (request, response) => {
  let insertedQuery = `insert into tweet (tweet)
    values('The Mornings...');`;
  await database.run(insertedQuery);
  response.send("Created a Tweet");
});
app.delete("/tweets/:tweetId", authenticateUser, async (request, response) => {
  let { tweetId } = request.params;
  let { username } = request;
  let userIdQuery = `SELECT user_id from user where username = '${username}';`;
  let userId = await database.get(userIdQuery);
  const { user_id } = userId;
  let deleteRequestQuery = `select user_id as delete_id from tweet where
  tweet_id = ${tweetId};`;
  let deleteRequestId = await database.get(deleteRequestQuery);
  const { delete_id } = deleteRequestId;
  console.log(delete_id);
  console.log(user_id);
  if (user_id === delete_id) {
    let deleteQuery = `delete from tweet where tweet_id = ${tweetId};`;
    await database.run(deleteQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
module.exports = app;
