// Author: Dhruba Ghosh
// Usage: Call ClipReader.bind to set a callback function that will be passed the parsed Sudoku

class ClipboardReader {
    constructor(cellSize = 65, threshold = 180) {
        this.callbackFn = null;

        // Adapted from https://ourcodeworld.com/articles/read/491/how-to-retrieve-images-from-the-clipboard-with-javascript-in-the-browser
        document.addEventListener("paste", (event) => {
            if (!event.clipboardData || !event.clipboardData.items) return;
            for (let item of event.clipboardData.items) {
                if (item.type.indexOf("image") != -1) {
                    let blob = item.getAsFile();
                    if (blob != null) {
                        this.parseBlob(blob);
                        event.preventDefault();
                        return;
                    }
                }
            }
        });

        this.N = 9;
        this.CELL_SIZE = cellSize;
        this.THRESH = threshold;
    }

    bind(fn) {
        this.callbackFn = fn;
    }

    parseBlob(blob) {
        if (!this.callbackFn) return;
        let cr = this;
        let canvas = document.createElement("canvas");
        let ctx = canvas.getContext("2d");
        let image = new Image();
        image.onload = function() {
            canvas.width = this.width, canvas.height = this.height;
            ctx.drawImage(this, 0, 0);
            cr.parseSudoku(ctx);
        }
        image.src = (URL || webkitURL).createObjectURL(blob);
    }

    parseSudoku(ctx) {
        // Find and crop to borders
        let image = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        let [xmin, xmax, ymin, ymax] = this.findBorders(image);
        // console.log("Crop from", xmin, ymin, "to", xmax, ymax);
        let canvas = document.createElement("canvas");
        canvas.width = canvas.height = this.CELL_SIZE * this.N;
        let newctx = canvas.getContext("2d");
        newctx.drawImage(
            ctx.canvas,
            xmin, ymin, xmax - xmin + 1, ymax - ymin + 1,
            0, 0, canvas.width, canvas.height
        );
        ctx = newctx;
        // Convert to grayscale and featurize
        const OFFSET = 6;
        let cells = [];
        for (let row = 0; row < this.N; row++) {
            for (let col = 0; col < this.N; col++) {
                let imageData = ctx.getImageData(
                    col * this.CELL_SIZE + OFFSET,
                    row * this.CELL_SIZE + OFFSET,
                    this.CELL_SIZE - 2 * OFFSET,
                    this.CELL_SIZE - 2 * OFFSET
                );
                let image = this.toGrayscale(imageData);
                cells.push(this.featurizePixel(image));
            }
        }
        // Compute digits through clustering
        let digits = this.hierClustering(cells.filter(x => x != null));
        let mapping = Array.from(new Set(digits));
        // Map features to actual digits
        let queryImageData = new ImageData(this.CELL_SIZE * mapping.length, this.CELL_SIZE);
        for (let idx = 0; idx < mapping.length; idx++) {
            let j = 0;
            for (let i = 0; i < cells.length; i++) {
                if (cells[i] != null) {
                    if (mapping.indexOf(digits[j]) == idx) {
                        let row = Math.floor(i / this.N), col = i % this.N;
                        let imageData = ctx.getImageData(
                            col * this.CELL_SIZE,
                            row * this.CELL_SIZE,
                            this.CELL_SIZE,
                            this.CELL_SIZE
                        );
                        for (let k = OFFSET; k < this.CELL_SIZE - OFFSET; k++) {
                            queryImageData.data.set(
                                imageData.data.subarray((k * this.CELL_SIZE + OFFSET) * 4, ((k + 1) * this.CELL_SIZE - OFFSET) * 4),
                                (k * (this.CELL_SIZE * mapping.length) + idx * this.CELL_SIZE + OFFSET) * 4
                            );
                        }
                        break;
                    }
                    j++;
                }
            }
        }
        canvas = document.querySelector("#query");
        canvas.width = this.CELL_SIZE * mapping.length, canvas.height = this.CELL_SIZE;
        ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(queryImageData, 0, 0);
        document.querySelector("#query-box").classList.add("querying");
        setTimeout(() => {
            let constmap = prompt("Are you a robot?\nEnter the digits", "123456789");
            document.querySelector("#query-box").classList.remove("querying");
            // Write to format string
            let format = "";
            let j = 0;
            for (let i = 0; i < this.N * this.N; i++) {
                if (cells[i] == null) {
                    format += "-";
                } else {
                    format += constmap[mapping.indexOf(digits[j++])];
                }
            }
            this.callbackFn(format);
        })
    }

    findBorders(image) {
        const index = (x, y) => 4 * (x + y * image.width);
        const lightness = (r, g, b) => 0.5 * (Math.max(r, g, b) + Math.min(r, g, b));
        const threshold = 180;
        // Find extents
        { // x min
            let lines = [];
            for (let x = 0; x < image.width; x++) {
                let pixels = 0;
                for (let y = 0; y < image.height; y++) {
                    let L = lightness(
                        image.data[index(x, y) + 0],
                        image.data[index(x, y) + 1],
                        image.data[index(x, y) + 2]
                    );
                    pixels += L < threshold;
                }
                if (pixels / image.height > 0.8) {
                    lines.push(x);
                } else if (lines.length) {
                    var xmin = lines.pop();
                    break;
                }
            }
            if (!lines.length) console.warn("Too bright");
        }
        { // x max
            let lines = [];
            for (let x = image.width - 1; x >= 0; x--) {
                let pixels = 0;
                for (let y = 0; y < image.height; y++) {
                    let L = lightness(
                        image.data[index(x, y) + 0],
                        image.data[index(x, y) + 1],
                        image.data[index(x, y) + 2]
                    );
                    pixels += L < threshold;
                }
                if (pixels / image.height > 0.8) {
                    lines.push(x);
                } else if (lines.length) {
                    var xmax = lines.pop();
                    break;
                }
            }
            if (!lines.length) console.warn("Too bright");
        }
        { // y min
            let lines = [];
            for (let y = 0; y < image.height; y++) {
                let pixels = 0;
                for (let x = 0; x < image.width; x++) {
                    let L = lightness(
                        image.data[index(x, y) + 0],
                        image.data[index(x, y) + 1],
                        image.data[index(x, y) + 2]
                    );
                    pixels += L < threshold;
                }
                if (pixels / image.width > 0.8) {
                    lines.push(y);
                } else if (lines.length) {
                    var ymin = lines.pop();
                    break;
                }
            }
            if (!lines.length) console.warn("Too bright");
        }
        { // y max
            let lines = [];
            for (let y = image.height - 1; y >= 0; y--) {
                let pixels = 0;
                for (let x = 0; x < image.width; x++) {
                    let L = lightness(
                        image.data[index(x, y) + 0],
                        image.data[index(x, y) + 1],
                        image.data[index(x, y) + 2]
                    );
                    pixels += L < threshold;
                }
                if (pixels / image.width > 0.8) {
                    lines.push(y);
                } else if (lines.length) {
                    var ymax = lines.pop();
                    break;
                }
            }
            if (!lines.length) console.warn("Too bright");
        }
        return [xmin, xmax, ymin, ymax];
    }

    toGrayscale(box) {
        const index = (x, y) => 4 * (x + y * box.width);
        // const lightness = (r, g, b) => 0.5 * (Math.max(r, g, b) + Math.min(r, g, b));
        const lightness = (r, g, b) => Math.max(r, g, b);
        let gray = new Uint8ClampedArray(box.height * box.width);
        for (let y = 0; y < box.height; y++) {
            for (let x = 0; x < box.width; x++) {
                let L = lightness(
                    box.data[index(x, y) + 0],
                    box.data[index(x, y) + 1],
                    box.data[index(x, y) + 2]
                );
                gray[x + y * box.width] = Math.floor(L);
            }
        }
        gray.width = box.width,
        gray.height = box.height;
        gray.at = function(x, y) {
            return this[x + y * this.width];
        };
        return gray;
    }

    digitBoundingBox(image) {
        let foundpixel = false;
        let extent = [0, 0, 0, 0];
        for (let y = 0; y < image.height; y++) {
            for (let x = 0; x < image.width; x++) {
                if (image.at(x, y) < this.THRESH) {
                    if (foundpixel) {
                        extent[0] = Math.min(x, extent[0]),
                        extent[1] = Math.min(y, extent[1]),
                        extent[2] = Math.max(x, extent[2]),
                        extent[3] = Math.max(y, extent[3]);
                    } else {
                        foundpixel = true;
                        extent = [x, y, x, y];
                    }
                }
            }
        }
        return extent;
    }

    featurizePixel(image) {
        let bbox = this.digitBoundingBox(image);
        // Actually determine value
        // Blank cell
        if ((bbox[2] - bbox[0]) * (bbox[3] - bbox[1]) < 0.02 * this.CELL_SIZE * this.CELL_SIZE) {
            return null;
        }
        // Get baseline
        let baseline = Math.min(...image);
        // Circle subsectors
        let center = [0.5 * (bbox[0] + bbox[2]), 0.5 * (bbox[1] + bbox[3])];
        let radius = 0;
        for (let y = bbox[1]; y <= bbox[3]; y++) {
            for (let x = bbox[0]; x < bbox[2]; x++) {
                let dist = Math.hypot(x - center[0], y - center[1]);
                if (dist > radius) {
                    radius = dist;
                }
            }
        }
        const polar = (dx, dy) => [Math.hypot(dy, dx), Math.atan2(dy, dx)];
        // Get value of subsectors
        const radii = 3, angles = 12;
        let features = [];
        for (let i = 0; i < radii; i++) {
            for (let j = 0; j < angles; j++) {
                let feature = 0, totalWeight = 0;
                for (let y = bbox[1]; y <= bbox[3]; y++) {
                    for (let x = bbox[0]; x < bbox[2]; x++) {
                        let [r, th] = polar(x - center[0], y - center[1]);
                        if (r < radius * i / radii
                            || r > radius * (i + 1) / radii
                            || th < 2 * Math.PI * j / angles - Math.PI
                            || th > 2 * Math.PI * (j + 1) / angles - Math.PI) continue;
                        feature += Math.max(1 - (image.at(x, y) - baseline) / this.THRESH, 0);
                        totalWeight += 1;
                    }
                }
                feature /= totalWeight || 1;
                features.push(feature);
            }
        }
        return Float32Array.from(features);
    }

    hierClustering(data) {
        const n = data.length, d = data[0].length;
        // Useful functions
        const distance = (v, w) => {
            let dist = 0;
            for (let k = 0; k < d; k++) {
                dist += (v[k] - w[k]) * (v[k] - w[k]);
            }
            return dist;
        };
        const unique = (array) => new Set(array).size;
        // Initialize groups
        let group = new Uint8ClampedArray(data.length);
        for (let i = 0; i < n; i++) {
            group[i] = i;
        }
        // Loop
        var maximalDist = 0;
        while (unique(group) > this.N) {
            // Find closest pair
            let minDist = Infinity;
            let minPair = null;
            for (let i = 0; i < n; i++) {
                for (let j = i + 1; j < n; j++) {
                    if (group[i] == group[j]) continue;
                    let dist = distance(data[i], data[j]);
                    if (dist < minDist) {
                        minDist = dist;
                        minPair = [i, j];
                    }
                }
            }
            minPair = [group[minPair[0]], group[minPair[1]]];
            // Union
            for (let i = 0; i < n; i++) {
                if (group[i] == minPair[1]) {
                    group[i] = minPair[0];
                }
            }
            maximalDist = minDist;
        }
        // Compress everything within a multiple of max distance (for <9 digits)
        let threshold = maximalDist * 1.0 + 0.01; // Arbitrary
        // {
        //     // Find closest pair
        //     let minDist = threshold;
        //     let minPair = null;
        //     for (let i = 0; i < n; i++) {
        //         for (let j = i + 1; j < n; j++) {
        //             if (group[i] == group[j]) continue;
        //             let dist = distance(data[i], data[j]);
        //             if (dist < minDist) {
        //                 minDist = dist;
        //                 minPair = [i, j];
        //             }
        //         }
        //     }
        //     if (minPair != null) {
        //         minPair = [group[minPair[0]], group[minPair[1]]];
        //         // Union
        //         for (let i = 0; i < n; i++) {
        //             if (group[i] == minPair[1]) {
        //                 group[i] = minPair[0];
        //             }
        //         }
        //         maximalDist = minDist;
        //     }
        // }
        let minDist = Infinity;
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                if (group[i] == group[j]) continue;
                let dist = distance(data[i], data[j]);
                if (dist < minDist) {
                    minDist = dist;
                }
            }
        }
        // console.log(this.CELL_SIZE, maximalDist, threshold, minDist);
        return group;
    }
}

var ClipReader = new ClipboardReader();