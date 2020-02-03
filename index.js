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

const uri = "mongodb+srv://kalitsinskiy:09042000@cluster0-wdwcd.mongodb.net/test?retryWrites=true&w=majority";
const port = process.env.PORT || '5000';

const User = require("./models/user");

let tokens=[];

index.use(bodyPareser.json());
index.use(bodyPareser.urlencoded({extended: true}));
index.use(cors());

mongoose.connect( uri, { useNewUrlParser: true, useUnifiedTopology: true, useCreateIndex: true });


index.get('/', (req, res) => res.send("Hello, it's a ExpIt api"));

index.get('/users', (req, res) => {
    User.find()
        .select('name email role id -_id')
        .exec()
        .then( response => res.status(200).json(response))
        .catch(err => res.status(404).json(err));
});

index.post('/user', (req, res) => {
    const {password, email, name, role} = req.body;

    const user = new User({
        email,
        name,
        role,
        // password,
        password: jwt.sign({password}, 'cryptoPassword'),
        id: new mongoose.Types.ObjectId()});

    user.save()
        .then(() => res.status(200).json({email, name, role}))
        .catch(err => res.status(500).json(err));
});

index.put('/user/:id', (req, res) => {
    const {id} = req.params;
    User.updateOne({id}, {$set: req.body})
        .then(response => {
            if(response){
                User.findOne({id})
                    .exec()
                    .then( response => res.status(200).json(response))
                    .catch(() => res.status(404).json("user doesn't exist"));
            }else {
                res.status(404).json("user doesn't exist")
            }
        })
        .catch(err => res.status(404).json(err));
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

server.listen(port, () => console.log(`listening on port ${port}`));