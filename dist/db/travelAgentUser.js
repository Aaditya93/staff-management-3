"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTravelAgentUser = exports.getTravelAgentUserByEmail = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const db_1 = __importDefault(require("./db"));
// Create schema
const TravelAgentUserSchema = new mongoose_1.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    password: {
        type: String,
    },
    company: {
        type: String,
    },
    country: {
        type: String,
    },
    address: {
        type: String,
    },
    phoneNumber: {
        type: String,
    },
}, { timestamps: true });
const TravelAgentUser = mongoose_1.default.models.TravelAgentUser ||
    mongoose_1.default.model("TravelAgentUser", TravelAgentUserSchema);
exports.default = TravelAgentUser;
const getTravelAgentUserByEmail = (email) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        const user = yield TravelAgentUser.findOne({ email }).lean();
        return user;
    }
    catch (error) {
        console.error("Error while getting user by email:", error);
        return null;
    }
});
exports.getTravelAgentUserByEmail = getTravelAgentUserByEmail;
const createTravelAgentUser = (name, email, company) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        const newUser = new TravelAgentUser({
            name,
            email,
            company,
        });
        const savedUser = yield newUser.save();
        return savedUser;
    }
    catch (error) {
        console.error("Error while creating user:", error);
        return null;
    }
});
exports.createTravelAgentUser = createTravelAgentUser;
