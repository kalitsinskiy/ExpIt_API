const express = require('express');
const index = express();
const server = require('http').createServer(index);
const bodyPareser = require('body-parser');
const cors = require('cors');
const _ = require("lodash");
const randtoken = require('rand-token').suid;
const jwt = require('jsonwebtoken');
const jwtDecode = require('jwt-decode');
const mongoose = require('mongoose');
const nodemailer = require("nodemailer");
const smtpTransport = require('nodemailer-smtp-transport');

const uri = "mongodb+srv://kalitsinskiy:09042000@cluster0-wdwcd.mongodb.net/test?retryWrites=true&w=majority";
const mailer_email = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImthbGl0c2luc2tpai40NkBnbWFpbC5jb20iLCJpYXQiOjE1ODA4NDU4OTB9.1eaehXVF1HdW1POR1p8xcKcRoiwOUUjvZ4Z8wFsWUbA";
const mailer_pass = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwYXNzd29yZCI6IjA5MDQyMDAwIiwiaWF0IjoxNTgwODQ1OTQwfQ.DL_1CvRU_9REu8WgfpwuQvKjW40JHjL1-r_fZ7SG36M";

const port = process.env.PORT || '5000';

const User = require("./models/user");
const Expertise = require("./models/expertise");
const Opinion = require("./models/opinion");

let tokens=[];
let reset_tokens=[];

index.use(bodyPareser.json());
index.use(bodyPareser.urlencoded({extended: true}));
index.use(cors());

mongoose.connect( uri, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });

const isFractionalPart = x => x.toString().includes('.');


index.get('/', (req, res) => res.send("Hello, it's a ExpIt api"));

index.get('/users', (req, res) => {
    User.find()
        .select('name email role id -_id')
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.route('/user')
    .get((req, res)=>{
        User.findOne({id: req.query.id})
            .select('email name role id -_id')
            .exec()
            .then( response => {
                if (response){
                    res.status(200).json(response)
                }else {
                    res.status(404).json("User not found")
                }
            })
            .catch(err => res.status(401).json(err));
    })
    .post((req, res) => {
        const {password, email, name} = req.body;

        const user = new User({
            email,
            name,
            role:"",
            password: jwt.sign({password}, 'cryptoPassword'),
            id: new mongoose.Types.ObjectId()
        });

        user.save()
            .then(({email, name, role}) => res.status(200).json({email, name, role}))
            .catch(err => res.status(500).json(err));
    })
    .put((req, res) => {
        User.updateOne({id: req.query.id}, {$set: req.body})
            .then(response => {
                if (response) {
                    User.findOne({id: req.query.id})
                        .exec()
                        .then(response => res.status(200).json(response))
                        .catch(err => res.status(500).json(err));
                } else {
                    res.status(404).json("user doesn't exist")
                }
            })
            .catch(err => res.status(500).json(err));
    })
    .delete((req, res) => {
        User.deleteOne({id: req.query.id})
            .exec()
            .then(() => res.status(200).json("ok"))
            .catch((err) => res.status(404).json(err));
    });

index.get('/expertises', (req, res) => {
    Expertise.find()
        .select('name keys creator_name creator_id id -_id')
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.route('/expertise')
    .get((req, res)=>{
        const id = req.query.id;
        if (id) {
            Expertise.findOne({id})
                .select('name keys creator_name creator_id id -_id')
                .exec()
                .then( response => {
                    if (response){
                        const {name, creator_name, creator_id, creation_date, keys} = response;

                        Opinion.find({expertise_id: id})
                            .select('user_name user_id results publishedAt expertise_id id -_id')
                            .exec()
                            .then( result => {
                                if (result){
                                    res.status(200).json({name, creator_name, creator_id, creation_date, keys, result})
                                }else {
                                    res.status(200).json(response)
                                }
                            })
                            .catch(() => res.status(200).json(response));
                    }else {
                        res.status(403)
                    }
                })
                .catch(err => res.status(401).json(err));
        }else {
            res.status(400).json("Need expertise id")
        }
    })
    .post((req, res) => {
        const {name, creator_name, creator_id, creation_date, keys} = req.body;

        const expertise = new Expertise({
            name, creator_name,
            creator_id, creation_date, keys,
            id: new mongoose.Types.ObjectId()
        });

        expertise.save()
            .then(({name, creator_name, creator_id, creation_date, keys, id}) => res.status(200).json({name, creator_name, creator_id, creation_date, keys, id}))
            .catch(err => res.status(500).json(err));
    })
    .put((req, res) => {
        Expertise.updateOne({id: req.query.id}, {$set: req.body})
            .then(response => {
                if (response) {
                    Expertise.findOne({id: req.query.id})
                        .exec()
                        .then(response => res.status(200).json(response))
                        .catch(() => res.status(404).json("expertise doesn't exist"));
                } else {
                    res.status(404).json("expertise doesn't exist")
                }
            })
            .catch(err => res.status(404).json(err));
    })
    .delete((req, res) => {
        Expertise.deleteOne({id: req.query.id})
            .exec()
            .then(() => res.status(200).json("ok"))
            .catch((err) => res.status(404).json(err));
    });

index.get('/result', (req, res) => {
    const expertise_id = req.query.expertise_id;

    if (expertise_id){
        Expertise.findOne({id: expertise_id})
            .select('keys name -_id')
            .exec()
            .then( response => {
                const {keys, name} = response;

                Opinion.find({expertise_id})
                    .select('results -_id')
                    .exec()
                    .then( response => response.map(it => it.results || []))
                    .then( response => {
                        if (response){
                            let result={};

                            keys.map((key, index) => {
                                const val = _.sum(response.map(val => val[index]) || 0) / response.length;
                                result[key] = isFractionalPart(val) ? +val.toFixed(3) : val;
                            });

                            res.status(200).json(result)
                        }else {
                            res.status(404).json(`Result for ${name} not found`)
                        }
                    })
                    .catch(err => res.status(401).json(err));
            })
            .catch(err => res.status(401).json(err));
    } else {
        res.status(404).json("Need expertise_id")
    }

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
    .get((req, res)=>{
        const id = req.query.id;
        if(id){
            Opinion.findOne({id})
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
        }else {
            res.status(400).json("Need opinion id")
        }
    })
    .post((req, res) => {
        const {user_name, user_id, results, publishedAt, expertise_id} = req.body;

        const opinion = new Opinion({
            user_name, user_id, results,
            publishedAt, expertise_id,
            id: new mongoose.Types.ObjectId()
        });

        opinion.save()
            .then(({user_name, user_id, results, publishedAt, expertise_id, id}) => res.status(200).json({user_name, user_id, results, publishedAt, expertise_id, id}))
            .catch(err => res.status(500).json(err));
    })
    .put((req, res) => {
        Opinion.updateOne({id: req.query.id}, {$set: req.body})
            .then(response => {
                if (response) {
                    Opinion.findOne({id: req.query.id})
                        .exec()
                        .then(response => res.status(200).json(response))
                        .catch(() => res.status(404).json("opinion doesn't exist"));
                } else {
                    res.status(404).json("opinion doesn't exist")
                }
            })
            .catch(err => res.status(404).json(err));
    })
    .delete((req, res) => {
        Opinion.deleteOne({id: req.query.id})
            .exec()
            .then(() => res.status(200).json("ok"))
            .catch((err) => res.status(404).json(err));
    });

index.post('/login', (req, res) => {
    const {email, password} = req.body;
    const innerPass = jwtDecode(password).password;

    User.findOne({email})
        .exec()
        .then( response => {
            if(response && jwtDecode(response.password).password === innerPass){
                const { id, name, surname, email, birthday, phone, role} = response;
                const token = randtoken(16);

                tokens.push({"token": token, id});
                tokens = _.uniqBy(tokens, 'id');

                res.status(200).json({response: {id,  name, surname, email, birthday, phone, role}, token})
            }else {
                res.status(403).json("user not found")
            }
        })
        .catch(err => res.status(401).json(err));
});

index.get('/session',(req, res) => {
    if (tokens.length === 0 && req.query.token){
        res.json({
            error: true,
            status:"Failed",
            message:"Session not founds"
        })
    } else {
        const id = tokens.find(item => item.token === req.query.token).id;

        if(id){
            User.findOne({id})
                .select('name email role id -_id')
                .exec()
                .then( response => {
                    if (response){
                        res.status(200).json(response)
                    }else {
                        res.status(403)
                    }
                })
                .catch(err => res.status(401).json(err));
        }else {
            res.json({
                error: true,
                status:"Failed",
                message:"Session not founds"
            })
        }
    }
});

index.get('/logout',(req, res) => {
    if (req.query.token) {
        tokens = tokens.filter((item) => req.query.token !== item.token);
        res.send("OK");
    }else {
        res.send("Error");
    }
});

index.post('/forgot', (req, res) => {
    const email = req.body.email;

    User.findOne({email})
        .select('id -_id')
        .exec()
        .then( response => {
            if (response){
                const id = response.id;
                const token = randtoken(32);
                reset_tokens = reset_tokens.filter(it => it.id !== id);

                const transporter = nodemailer.createTransport(smtpTransport({
                    service: 'gmail',
                    host: "smtp.gmail.com",
                    auth: {
                        user: jwtDecode(mailer_email).email,
                        pass: jwtDecode(mailer_pass).password
                    }
                }));

                const mailOptions = {
                    from: jwtDecode(mailer_email).email,
                    to: email,
                    subject: "Reset password ✔",
                    text: `For changing password follow by this link ${`http://localhost:3000`}/reset?token=${token}`,
                };

                transporter.sendMail(mailOptions,  (err, info) => {
                    if(err){
                        res.status(500).json(err);
                    }
                    else{
                        reset_tokens.push({id, token});
                        res.status(200).json(info);
                    }
                });
            }else {
                res.status(404).json("User not found")
            }
        })
        .catch(err => res.status(500).json(err));
});

index.post("/reset",(req, res) => {
    const password = jwt.sign({password: req.body.password}, 'cryptoPassword');
    const token =  req.body.token;
    const reset = reset_tokens.find(it => it.token === token);

    if (reset){
        User.updateOne({id: reset.id}, {$set: {password}})
            .then(() => res.status(200).json("Success"))
            .catch(err => res.status(401).json(err));
    }else {
        res.status(404).json("Bad token")
    }
    reset_tokens = reset_tokens.filter(it => it.token !== token)
});

server.listen(port, () => console.log(`listening on port ${port}`));