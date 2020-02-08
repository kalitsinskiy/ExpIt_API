const express = require('express');
const index = express();
const server = require('http').createServer(index);
const bodyPareser = require('body-parser');
const cors = require('cors');
const {sum, isEmpty} = require("lodash");
const randtoken = require('rand-token').suid;
const jwt = require('jsonwebtoken');
const jwtDecode = require('jwt-decode');
const mongoose = require('mongoose');
const nodemailer = require("nodemailer");
const smtpTransport = require('nodemailer-smtp-transport');
const cookieParser = require('cookie-parser');

const secret = jwtDecode("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZCI6IjA5MDQyMDAwIiwiaWF0IjoxNTgwODQ1OTQwfQ.DL_1CvRU_9REu8WgfpwuQvKjW40JHjL1-r_fZ7SG36M").password;
const mailer_email = jwtDecode("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImthbGl0c2luc2tpai40NkBnbWFpbC5jb20iLCJpYXQiOjE1ODA4NDU4OTB9.1eaehXVF1HdW1POR1p8xcKcRoiwOUUjvZ4Z8wFsWUbA").email;
const secretCode = jwtDecode("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZWNyZXQiOiJjcnlwdG9QYXNzd29yZCIsImlhdCI6MTU4MTE4ODc1N30._LWEUsKhDYmnvhp7UIB5fUgduqAhjb6vYAkCwnaa1l4").secret;
const uri = `mongodb+srv://kalitsinskiy:${secret}@cluster0-wdwcd.mongodb.net/test?retryWrites=true&w=majority`;

const port = process.env.PORT || '5000';

const User = require("./models/user");
const Expertise = require("./models/expertise");
const Opinion = require("./models/opinion");

let sessions=[];
let reset_tokens=[];

index.use(bodyPareser.json());
index.use(bodyPareser.urlencoded({extended: true}));
index.use(cors());
index.use(cookieParser(secret));

mongoose.connect( uri, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });

const isAuth = (checkAdmin = false) => {
    return [
        (req, res, next) => {
            if (isEmpty(sessions)) {
                return res.status(401).json({message: "Unauthorized"});
            } else {
                const session_user = sessions.find(ses => ses.token === req.signedCookies.token);

                if (session_user) {
                    if (checkAdmin) {
                        if (session_user.isAdmin) {
                            next();
                        } else {
                            return res.status(403).json({message: "You haven't permission"});
                        }
                    } else {
                        next();
                    }
                } else {
                    return res.status(401).json({message: "Unauthorized"});
                }
            }
        }
    ];
};
const isQueryKey = (target = "target", key = "id") => {
    return [
        (req, res, next) => req.query[key] ? next() : res.status(400).json({message: `Need ${target}'s ${key}`})
    ];
};


index.get('/', (req, res) => res.send("Hello, it's a ExpIt api"));

index.get('/users', /*isAuth(), isAdmin(),*/ (req, res) => {
    User.find()
        .select('name email role id -_id')
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(500).json(err));
});

index.route('/user')
    .get(isQueryKey("User"), (req, res)=>{
        User.findOne({id: req.query.id})
            .select('email name role id -_id')
            .exec()
            .then( response => {
                if (response){
                    res.status(200).json(response)
                }else {
                    res.status(404).json({message: "User not found"})
                }
            })
            .catch(err => res.status(500).json(err));
    })
    .post((req, res) => {
        const {password, email, name} = req.body;

        if (password){
            const user = new User({
                email,
                name,
                password: jwt.sign({password}, secretCode),
                id: new mongoose.Types.ObjectId()
            });

            user.save()
                .then(({email, name, role, id}) => res.status(200).json({email, name, role, id}))
                .catch(err => res.status(400).json(err));
        }else {
            res.status(400).json({message: "Password is absent"})
        }
    })
    .put(isAuth(), isQueryKey("User"), (req, res) => {
        const session_user = sessions.find(ses => ses.token === req.signedCookies.token);

        if (req.query.id === session_user.id) {
            User.updateOne({id: req.query.id}, {$set: req.body})
                .then(response => {
                    if (response) {
                        User.findOne({id: req.query.id})
                            .exec()
                            .then(response => res.status(200).json(response))
                            .catch(err => res.status(400).json(err));
                    } else {
                        res.status(404).json({message: "User doesn't exist"})
                    }
                })
                .catch(err => res.status(400).json(err));
        } else {
            res.status(403).json({message: "You haven't permission"})
        }
    })
    .delete(isAuth(), isQueryKey("User"), (req, res) => {
        const session_user = sessions.find(ses => ses.token === req.signedCookies.token);
        User.findOne({id: session_user.id})
            .select('role id -_id')
            .exec()
            .then( ({role, id}) => {
                if (role === "admin" || id.toString() === req.query.id){
                    User.deleteOne({id: req.query.id})
                        .exec()
                        .then(() => res.status(200).json("ok"))
                        .catch((err) => res.status(500).json(err));
                }else {
                    res.status(403).json({message: "You haven't permission"})
                }
            })
            .catch(err => res.status(500).json(err));
    });

index.get('/expertises', (req, res) => {
    Expertise.find()
        .select('name keys creator_name creator_id id -_id')
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(400).json(err));
});

index.route('/expertise')
    .get(isQueryKey("Expertise"), (req, res) => {
        const {id, opinions} = req.query;
        Expertise.findOne({id})
            .select('name keys creator_name creator_id creation_date id -_id')
            .exec()
            .then(response => {
                if (response) {
                    if (opinions) {
                        Opinion.find({expertise_id: id})
                            .select('user_name user_id results publishedAt expertise_id id -_id')
                            .exec()
                            .then(opinions => res.status(200).json({response, opinions: opinions || []}))
                            .catch(() => res.status(200).json(response));
                    } else {
                        res.status(200).json(response)
                    }
                } else {
                    res.status(404).json("Expertise not found")
                }
            })
            .catch(err => res.status(500).json(err));
    })
    .post(isAuth(), (req, res) => {
        const expertise = new Expertise({
            ...req.body,
            id: new mongoose.Types.ObjectId()
        });

        expertise.save()
            .then(({name, creator_name, creator_id, creation_date, keys, id}) => res.status(200).json({name, creator_name, creator_id, creation_date, keys, id}))
            .catch(err => res.status(500).json(err));
    })
    .put(isAuth(), isQueryKey("Expertise"), (req, res) => {
        Expertise.updateOne({id: req.query.id}, {$set: req.body})
            .then(response => {
                if (response) {
                    Expertise.findOne({id: req.query.id})
                        .exec()
                        .then(response => res.status(200).json(response))
                        .catch(err => res.status(500).json(err));
                } else {
                    res.status(404).json({message: "Expertise doesn't exist"})
                }
            })
            .catch(err => res.status(500).json(err));
    })
    .delete(isAuth(), isQueryKey("Expertise"), (req, res) => {
        Expertise.deleteOne({id: req.query.id})
            .exec()
            .then(() => res.status(200).json("ok"))
            .catch((err) => res.status(404).json(err));
    });

index.get('/result', isQueryKey("Results","expertise_id"), (req, res) => {
    Expertise.findOne({id: req.query.expertise_id})
        .select('keys name -_id')
        .exec()
        .then( response => {
            if (response){
                const {keys, name} = response;

                Opinion.find({expertise_id: req.query.expertise_id})
                    .select('results -_id')
                    .exec()
                    .then( response => response.map(it => it.results || []))
                    .then( response => {
                        if (response){
                            let result={};

                            keys.map((key, index) => {
                                const val = sum(response.map(val => val[index]) || 0) / response.length;
                                result[key] = val.toString().includes('.') ? +val.toFixed(3) : val;
                            });

                            res.status(200).json(result)
                        }else {
                            res.status(404).json({message: `Result for ${name} not found`})
                        }
                    })
                    .catch(err => res.status(500).json(err));
            }else {
                res.status(404).json({message: `Expertise not found`})
            }
        })
        .catch(err => res.status(500).json(err));
});

index.get('/opinions', (req, res) => {
    if (req.query.expertise_id){
        Opinion.find({expertise_id: req.query.expertise_id})
            .select('user_name user_id results publishedAt expertise_id id -_id')
            .exec()
            .then( response => {
                if (response){
                    res.status(200).json(response)
                }else {
                    res.status(403)
                }
            })
            .catch(err => res.status(401).json(err));
    } else {
        Opinion.find()
            .select('user_name user_id results publishedAt expertise_id id -_id')
            .exec()
            .then( response => res.status(200).json(response))
            .catch(err => res.status(404).json(err));
    }
});

index.route('/opinion')
    .get(isQueryKey("Opinion"), (req, res) => {
        Opinion.findOne({id: req.query.id})
            .select('user_name user_id results publishedAt expertise_id id -_id')
            .exec()
            .then(response => res.status(200).json(response))
            .catch(err => res.status(500).json(err));

    })
    .post((req, res) => {
        const {user_name, user_id, results, publishedAt, expertise_id} = req.body;

        Expertise.findOne({id: expertise_id})
            .select('keys -_id')
            .exec()
            .then(response => {
                const keys = response.keys;
                if (response && keys.length > 0){
                    if (keys.length !== results.length) {
                        res.status(400).json({message: `Results array must contain ${keys.length} values`})
                    } else {
                        const opinion = new Opinion({
                            user_name, user_id, results,
                            publishedAt, expertise_id,
                            id: new mongoose.Types.ObjectId()
                        });

                        opinion.save()
                            .then(({user_name, user_id, results, publishedAt, expertise_id, id}) => {
                                res.status(200).json({user_name, user_id, results, publishedAt, expertise_id, id})
                            })
                            .catch(err => res.status(500).json(err));
                    }
                }else {
                    res.status(400).json({message: "This expertise doesn't contain any keys"})
                }
            })
            .catch(err => res.status(500).json(err));
    })
    .put((req, res) => {
        const id = req.query.id;

        if (id){
            Opinion.updateOne({id}, {$set: req.body})
                .then(response => {
                    if (response) {
                        Opinion.findOne({id: req.query.id})
                            .exec()
                            .then(response => res.status(200).json(response))
                            .catch(() => res.status(404).json("opinion doesn't exist"));
                    } else {
                        res.status(404).json({message: "Opinion doesn't exist"})
                    }
                })
                .catch(err => res.status(500).json(err));
        }else {
            res.status(400).json("Need opinion id")
        }
    })
    .delete(isAuth(), isQueryKey("Opinion"), (req, res) => {
        const id = req.query.id;
        const session_user = sessions.find(ses => ses.token === req.signedCookies.token);

        if (session_user.isAdmin) {
            Opinion.deleteOne({id})
                .exec()
                .then(() => res.status(200).json("ok"))
                .catch(err => res.status(500).json(err));
        } else {
            Opinion.findOne({id})
                .exec()
                .then(opinion => {
                    if (opinion) {
                        if (opinion.user_id === session_user.id) {
                            Opinion.deleteOne({id})
                                .exec()
                                .then(() => res.status(200).json("ok"))
                                .catch(err => res.status(500).json(err));
                        } else {
                            res.status(403).json({message: "You don't have permission"})
                        }
                    } else {
                        res.status(403).json({message: "Opinion doesn't exist"})
                    }
                })
                .catch(err => res.status(500).json(err));
        }
    });

index.post('/login', (req, res) => {
    User.findOne({email: req.body.email})
        .select('name email role id password -_id')
        .exec()
        .then( response => {
            if(response){
                if(jwtDecode(response.password).password === req.body.password){
                    const { name, email, role, id } = response;
                    const token = randtoken(16);
                    const now = new Date();
                    const tokenSettings = {
                        expires: new Date(now.setMonth(now.getMonth() === 11 ? 1 : now.getMonth() + 1)),  // 1 month
                        httpOnly: true,
                        signed: true
                    };

                    sessions = sessions.filter(ses => ses.token !== req.signedCookies.token);
                    sessions.push({
                        token,
                        id: id.toString(),
                        isAdmin: role === "admin"
                    });

                    res.status(200)
                       .cookie('token', token, tokenSettings)
                       .json({name, email, role, id});
                }else {
                    res.status(401).json({message: "Incorrect password"});
                }
            }else {
                res.status(404).json({message: "User doesn't exist with this email"});
            }
        })
        .catch(err => res.status(500).json(err));
});

index.get('/session', isAuth(), (req, res) => {
    const session = sessions.find(item => item.token === req.signedCookies.token);

    User.findOne({id: session.id})
        .select('name email role id -_id')
        .exec()
        .then(response => res.status(200).json(response))
        .catch(err => res.status(500).json(err));
});

index.get('/logout',(req, res) => {
    sessions = sessions.filter((item) => req.signedCookies.token !== item.token);
    res.status(200).clearCookie("token").json("OK")
});

index.post('/forgot', (req, res) => {
    const email = req.body.email;

    if (email) {
        User.findOne({email})
            .select('id -_id')
            .exec()
            .then(response => {
                if (response) {
                    const id = response.id;
                    const token = randtoken(32);
                    reset_tokens = reset_tokens.filter(it => it.id !== id);

                    const transporter = nodemailer.createTransport(smtpTransport({
                        service: 'gmail',
                        host: "smtp.gmail.com",
                        auth: {
                            user: mailer_email,
                            pass: secret
                        }
                    }));

                    const mailOptions = {
                        from: mailer_email,
                        to: email,
                        subject: "Reset password ✔",
                        text: `For changing password follow by this link ${`http://localhost:3000`}/reset?token=${token}`,
                    };

                    transporter.sendMail(mailOptions, (err, info) => {
                        if (err) {
                            res.status(500).json(err);
                        } else {
                            reset_tokens.push({id, token});
                            res.status(200).json({message: "Check your email"});
                        }
                    });
                } else {
                    res.status(404).json({message: "User not found"})
                }
            })
            .catch(err => res.status(500).json(err));
    } else {
        res.status(404).json({message: "Need to providing email"})
    }
});

index.post("/reset",(req, res) => {
    const password = jwt.sign({password: req.body.password}, secretCode);
    const token = req.body.token;
    const reset = reset_tokens.find(it => it.token === token);

    if (req.body.password){
        if (reset){
            User.updateOne({id: reset.id}, {$set: {password}})
                .then(() => res.status(200).json("Success"))
                .catch(err => res.status(401).json(err));
        }else {
            res.status(498).json({message: "Bad token"})
        }
        reset_tokens = reset_tokens.filter(it => it.token !== token)
    }else {
        res.status(404).json({message: "Need to providing new password"})
    }
});

server.listen(port, () => console.log(`listening on port ${port}`));