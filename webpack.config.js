const path = require("path");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
	entry: [
		path.join(__dirname, "ui/index.tsx")
	],
	module: {
		rules: [
			{
				test: /\.tsx?$/,
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
		extensions: [".ts", ".tsx", ".js"]
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
