import express from "express";
const router = express.Router();
router.get("/", (req, res) => {
    res.status(501).json({
        status: "not-implemented",
        service: "tomowa-api-me",
    });
});
export default router;
