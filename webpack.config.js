const path = require("path");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: [
		path.join(__dirname, "index.ts")
	],
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: ["ts-loader"]
			},
			{
				test: /\.css$/,
				use: ExtractTextPlugin.extract({
					use: "raw-loader"
				})
			}
		]
	},
	devtool: "source-map",
	resolve: {
		extensions: [".ts", ".js"]
	},
	output: {
		path: path.join(__dirname, "out"),
		filename: "scripts.js"
	},
	plugins: [
		new ExtractTextPlugin("bundle.css"),
		new CopyWebpackPlugin([
			{from: "assets/*", to: "[name].[ext]"}
		])
	]
};
