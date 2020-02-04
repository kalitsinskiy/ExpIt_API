const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const expertiseSchema = new Schema({
    name: {
        type: String,
        required: true,
        default: "",
        unique : true
    },
    creator_name: {
        type: String,
        required: true
    },
    creator_id: {
        type: String,
        required: true
    },
    creation_date: {
        type: Date
    },
    keys: {
        type: Array,
        required: true,
        default: []
    },
    id: mongoose.Schema.Types.ObjectId
});

const Expertise = mongoose.model("expertise", expertiseSchema);

module.exports = Expertise;