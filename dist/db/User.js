"use strict";
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateUserEmailTimestamp = exports.getAllUsers = exports.emailVerified = exports.getUserByEmail = exports.getUserById = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const db_1 = __importDefault(require("./db"));
const accountSchema = new mongoose_1.default.Schema({
    accessToken: String,
    refreshToken: String,
    expiresAt: Number,
    email: String,
    provider: String,
    emailUpdatedAt: Date,
}, { _id: true });
const userSchema = new mongoose_1.default.Schema({
    name: String,
    email: {
        type: String,
        unique: true,
        required: true,
        index: true,
    },
    password: {
        type: String,
    },
    role: {
        type: String,
        required: true,
        index: true,
    },
    office: {
        type: String,
    },
    rating: {
        type: Number,
        default: 0,
    },
    position: {
        type: String,
    },
    accounts: [accountSchema],
    travelAgentId: {
        type: mongoose_1.default.Schema.Types.ObjectId,
        ref: "TravelAgentUser",
    },
    country: String,
    provider: String,
    image: String,
    backgroundImage: String,
    emailVerified: Date,
}, { timestamps: true });
const User = (((_a = mongoose_1.default.models) === null || _a === void 0 ? void 0 : _a.User) ||
    mongoose_1.default.model("User", userSchema));
exports.default = User;
function getUserById(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            const user = yield User.findById(id).lean();
            return user;
        }
        catch (error) {
            console.error("Error while getting user by ID:", error);
            return null;
        }
    });
}
exports.getUserById = getUserById;
function getUserByEmail(email) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            const user = yield User.findOne({ email });
            return user;
        }
        catch (error) {
            console.error("Error while getting user by ID:", error);
            return null;
        }
    });
}
exports.getUserByEmail = getUserByEmail;
function emailVerified(id) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield (0, db_1.default)();
            const user = yield User.findByIdAndUpdate(id, { emailVerified: new Date() }, { new: true });
            if (!user) {
                throw new Error("User not found");
            }
            return user;
        }
        catch (error) {
            console.error("Error verifying email:", error);
            throw error;
        }
    });
}
exports.emailVerified = emailVerified;
const getAllUsers = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        const users = yield User.find({ role: "ReservationStaff" }).lean();
        return users;
    }
    catch (error) {
        console.error("Error while getting all users:", error);
        return [];
    }
});
exports.getAllUsers = getAllUsers;
const updateUserEmailTimestamp = (id, email) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        yield (0, db_1.default)();
        const updatedUser = yield User.findByIdAndUpdate(id, {
            $set: {
                [`accounts.$[elem].emailUpdatedAt`]: new Date(),
            },
        }, {
            arrayFilters: [{ "elem.email": email }],
            new: true,
            lean: true,
        });
        console.log("User Updated");
        if (!updatedUser) {
            throw new Error(`User with ID ${id} not found`);
        }
        console.log("Updated User", updatedUser);
        return updatedUser;
    }
    catch (error) {
        console.error("Error updating user email timestamp:", error);
        throw error;
    }
});
exports.updateUserEmailTimestamp = updateUserEmailTimestamp;
