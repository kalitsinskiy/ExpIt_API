const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OpinionSchema = new Schema({
    user_name: {
        type: String,
        required: true,
        default: ""
    },
    user_id: {
        type: String,
        required: true,
        default: ""
    },
    results: {
        type: [{
            type: Number,
            validate: [ val => val <= 2 && val >= -2, 'Value need to be between -2 and 2'],
            default: 0
        }],
        required: true,
        default: []
    },
    publishedAt: {
        type: Date,
        required: true
    },
    expertise_id: {
        type: String,
        required: true
    },
    id: mongoose.Schema.Types.ObjectId
});

const Opinion = mongoose.model("opinion", OpinionSchema);

module.exports = Opinion;