class Board {
    constructor(boardData) {
        this.removeOldBoard();
        this.solvedNodes = 0;
        this.puzzleArr = [];
        this.addCells(boardData);
        this.solve();
    }

    addCells(data) {
        let board = document.getElementById("board");
        for (let i = 0; i < 81; i++) {
            let cell = document.createElement("div");
            cell.className = "cell";
            let cellVal = parseInt(data.charAt(i));
            if (cellVal) {
                cell.innerHTML = cellVal;
                cell.classList.add("given-val");
                this.solvedNodes++;
                this.puzzleArr.push(cellVal);
            } else {
                this.puzzleArr.push([1, 2, 3, 4, 5, 6, 7, 8, 9]);
            }
            let row = Math.floor(i/9);
            let column = i%9;
            let box = 3*Math.floor(row/3) + Math.floor(column/3);
            cell.setAttribute("row", row);
            cell.setAttribute("column", column);
            cell.setAttribute("box", box);
            board.appendChild(cell);
        }
    }

    solve() {
        let board = document.getElementById("board");
        let cells = board.childNodes;
        while (this.solvedNodes < 81) {
            let pastPuzzleArr = this.puzzleArr.map((x) => x);
            for (let i = 0; i < 81; i++) {
                let currCell = cells[i];
                if (!currCell.innerHTML){
                    let possibleVals = this.puzzleArr[i];
                    let row = Math.floor(i/9);
                    let column = i%9;
                    let box = 3*Math.floor(row/3) + Math.floor(column/3);

                    for (let k = 0; k < 9; k++) {
                        let rowNum = possibleVals.indexOf(parseInt(board.querySelectorAll('[row="'+ row +'"]')[k].innerHTML));
                        if (rowNum != -1) {
                            possibleVals.splice(rowNum, 1);
                        }
                        let columnNum = possibleVals.indexOf(parseInt(board.querySelectorAll('[column="'+ column +'"]')[k].innerHTML));
                        if (columnNum != -1) {
                            possibleVals.splice(columnNum, 1);
                        }
                        let boxNum = possibleVals.indexOf(parseInt(board.querySelectorAll('[box="'+ box +'"]')[k].innerHTML));
                        if (boxNum != -1) {
                            possibleVals.splice(boxNum, 1);
                        }
                    }

                    if (possibleVals.length == 1) {
                        currCell.innerHTML = possibleVals[0];
                        currCell.classList.add("solved-val");
                        this.puzzleArr[i] = possibleVals[0];
                        this.solvedNodes++;
                    } else {
                        this.puzzleArr[i] = possibleVals;
                    }
                }
            }

            if (pastPuzzleArr.every((val, index) => val === this.puzzleArr[index])) {
                for (let i = 0; i < 81; i++) {
                    let currCell = cells[i]
                    if (!currCell.innerHTML) {
                        currCell.innerHTML = this.puzzleArr[i];
                        if (this.puzzleArr[i].length > 3) {
                            currCell.classList.add("unsolved-val-2-line");
                        } else {
                            currCell.classList.add("unsolved-val-1-line");
                        } 
                    }
                }
                break;
            }
        }
    }

    removeOldBoard() {
        let board = document.getElementById("board");
        while (board.firstChild) {
            board.removeChild(board.firstChild);
        }
    }
}

function solveBoard() {
    let input = document.getElementById("sudokuInput").value;
    board = new Board(input);
}

let sudoku = "4----3826--2----1----41-7-573---4---124-5-983---3---572-3-78----4----2--8762----1";
let emptySudoku = "---------------------------------------------------------------------------------"
let unsolvableSudoku = "4----38----2----1----41-7---3---4---124-5---3---3---572-3-78----4----2--87-------"
let atLeastOnePartSolveable = "45679382---2---------41-7---3---4---124-5---3---3---572-3-78----4----2--87-------"
let board = new Board(sudoku);

ClipReader.bind(function(format) {
    let input = document.getElementById("sudokuInput");
    input.value = format;
    solveBoard();
});