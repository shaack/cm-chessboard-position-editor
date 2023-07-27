/**
 * Author and copyright: Stefan Haack (https://shaack.com)
 * Repository: https://github.com/shaack/cm-chessboard-postion-editor
 * License: MIT, see file 'LICENSE'
 */
import {Extension} from "cm-chessboard/src/model/Extension.js"
import {PromotionDialog} from "cm-chessboard/src/extensions/promotion-dialog/PromotionDialog.js"
import {COLOR, INPUT_EVENT_TYPE} from "cm-chessboard/src/Chessboard.js"
import {MOVE_CANCELED_REASON} from "cm-chessboard/src/view/VisualMoveInput.js"
import {SelectPieceDialog} from "./extensions/SelectPieceDialog.js"
import {MARKER_TYPE} from "cm-chessboard/src/extensions/markers/Markers.js"

/*
ToDo
    - Select piece (done ✓)
    - Promotion (done ✓)
    - Castling (done ✓)
    - En passant (done ✓)
    - Take move back
    - Take all moves back
*/

// clone MARKER_TYPE.frame
const MARKER_TYPE_NEW_PIECE = { ...MARKER_TYPE.frame }

export class PositionEditor extends Extension {

    constructor(chessboard, props = {}) {
        super(chessboard)
        chessboard.addExtension(PromotionDialog)
        chessboard.addExtension(SelectPieceDialog)
        chessboard.enableMoveInput((event) => {
            switch (event.type) {
                case INPUT_EVENT_TYPE.moveInputStarted:
                    return true
                case INPUT_EVENT_TYPE.moveInputCanceled:
                    return this.onMoveInputCanceled(event)
                case INPUT_EVENT_TYPE.validateMoveInput:
                    return this.onValidateMoveInput(event)
                case INPUT_EVENT_TYPE.moveInputFinished:
                    return this.onMoveInputFinished(event)
            }
        })
        this.props = {
            autoSpecialMoves: true, // castling, en passant, promotion
            onPositionChanged: undefined // callback after each position change
        }
        Object.assign(this.props, props)
        this.dialogShown = false
        this.clickListener = this.onSquareClick.bind(this)
        chessboard.context.addEventListener("click", this.clickListener)
    }

    onMoveInputCanceled(event) {
        // remove piece if it was moved out of the board
        if (event.reason === MOVE_CANCELED_REASON.movedOutOfBoard) {
            this.chessboard.setPiece(event.squareFrom, null)
            if (this.props.onPositionChanged) {
                this.props.onPositionChanged(this.chessboard.getPosition())
            }
        }
    }

    onValidateMoveInput(event) {
        if (this.chessboard.getPiece(event.squareTo)) {
            this.captured = this.chessboard.getPiece(event.squareTo)
        } else {
            this.captured = null
        }
        return this.handlePromotion(event)
    }

    onMoveInputFinished(event) {
        if (event.squareTo && this.props.autoSpecialMoves) {
            this.handleCastling(event)
            this.handleEnPassant(event)
        }
        if (this.props.onPositionChanged && event.legalMove) {
            this.props.onPositionChanged(this.chessboard.getPosition())
        }
    }

    handlePromotion(event) {
        const piece = this.chessboard.getPiece(event.squareFrom)
        const color = piece[0]
        const type = piece[1]
        if (type === "p" &&
            (color === COLOR.white && event.squareTo[1] === "8" ||
                color === COLOR.black && event.squareTo[1] === "1")) {
            this.chessboard.movePiece(event.squareFrom, event.squareTo, false)
            this.chessboard.showPromotionDialog(event.squareTo, color, (promoteTo) => {
                if(promoteTo) {
                    this.chessboard.setPiece(event.squareFrom, null, false)
                    this.chessboard.setPiece(promoteTo.square, promoteTo.piece, true)
                    if (this.props.onPositionChanged) {
                        this.props.onPositionChanged(this.chessboard.getPosition())
                    }
                } else {
                    this.chessboard.movePiece(event.squareTo, event.squareFrom, true)
                }
            })
            return false
        }
        return true
    }

    handleCastling(event) {
        const piece = this.chessboard.getPiece(event.squareTo)
        const color = piece[0]
        const type = piece[1]
        if (type === "k") {
            if (event.squareFrom[1] === "1" && event.squareTo[1] === "1" && color === COLOR.white) {
                if (event.squareFrom[0] === "e" && event.squareTo[0] === "g" && this.chessboard.getPiece("h1") === "wr") {
                    this.chessboard.movePiece("h1", "f1", true)
                } else if (event.squareFrom[0] === "e" && event.squareTo[0] === "c" && this.chessboard.getPiece("a1") === "wr") {
                    this.chessboard.movePiece("a1", "d1", true)
                }
            }
            if (event.squareFrom[1] === "8" && event.squareTo[1] === "8" && color === COLOR.black) {
                if (event.squareFrom[0] === "e" && event.squareTo[0] === "g" && this.chessboard.getPiece("h8") === "br") {
                    this.chessboard.movePiece("h8", "f8", true)
                } else if (event.squareFrom[0] === "e" && event.squareTo[0] === "c" && this.chessboard.getPiece("a8") === "br") {
                    this.chessboard.movePiece("a8", "d8", true)
                }
            }
        }
    }

    handleEnPassant(event) {
        const piece = this.chessboard.getPiece(event.squareTo)
        const color = piece[0]
        const type = piece[1]
        if (type === "p") {
            const rankFrom = parseInt(event.squareFrom[1], 10)
            const rankTo = parseInt(event.squareTo[1], 10)
            const fileFrom = COLOR.black.charCodeAt(0) - event.squareFrom[0].charCodeAt(0) + 8
            const fileTo = COLOR.black.charCodeAt(0) - event.squareTo[0].charCodeAt(0) + 8
            if (color === COLOR.white && rankFrom === 5 && rankTo === 6 && Math.abs(fileFrom - fileTo) === 1 &&
                !this.captured && this.chessboard.getPiece(event.squareTo[0] + event.squareFrom[1]) === "bp") {
                this.chessboard.setPiece(event.squareTo[0] + event.squareFrom[1], null, true)
            }
            if (color === COLOR.black && rankFrom === 4 && rankTo === 3 && Math.abs(fileFrom - fileTo) === 1 &&
                !this.captured && this.chessboard.getPiece(event.squareTo[0] + event.squareFrom[1]) === "wp") {
                this.chessboard.setPiece(event.squareTo[0] + event.squareFrom[1], null, true)
            }
        }
    }

    onSquareClick(event) {
        const square = event.target.getAttribute("data-square")
        if (square && !this.chessboard.getPiece(square)) {
            if (!this.dialogShown) {
                this.chessboard.showSelectPieceDialog(square, (result) => {
                    if (result) {
                        this.chessboard.setPiece(square, result.piece, true)
                        if (this.props.onPositionChanged) {
                            this.props.onPositionChanged(this.chessboard.getPosition())
                        }
                    }
                    setTimeout(() => {
                        this.dialogShown = false
                        this.chessboard.removeMarkers(MARKER_TYPE_NEW_PIECE, square)
                    })
                })
                this.chessboard.addMarker(MARKER_TYPE_NEW_PIECE, square)
            }
            this.dialogShown = true
        }
    }
}
