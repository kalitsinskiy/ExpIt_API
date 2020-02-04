const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const OpinionSchema = new Schema({
    user_name: {
        type: String,
        required: true,
        default: "",
        unique : true
    },
    user_id: {
        type: String,
        required: true,
        default: "",
        unique : true
    },
    results: {
        type: Array,
        required: true,
        default: []
    },
    publishedAt: {
        type: Date
    },
    expertise_id: {
        type: String,
        required: true
    },
    id: mongoose.Schema.Types.ObjectId
});

const Opinion = mongoose.model("opinion", OpinionSchema);

module.exports = Opinion;