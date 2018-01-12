const path = require("path");
const webpack = require("webpack");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CleanWebpackPlugin = require('clean-webpack-plugin');

module.exports = env => {
	const PRODUCTION = env.NODE_ENV == "production";
	let plugins = [
		new ExtractTextPlugin(PRODUCTION ? "styles.[contenthash:10].css" : "styles.css"),
		new CopyWebpackPlugin([
			{from: "ui/assets/*", to: "[name].[ext]"}
		]),
		new HtmlWebpackPlugin({
			filename: "index.html",
			template: "ui/index.template.html"
		}),
		new webpack.DefinePlugin({
			'process.env': {
				NODE_ENV: JSON.stringify(env.NODE_ENV)
			}
		}),
	];
	if (PRODUCTION) {
		plugins.push(
			new UglifyJSPlugin({
				uglifyOptions: {
					output: {
						comments: /\b(Copyright|MIT|@license)\b/i
					}
				}
			}),
			new CleanWebpackPlugin(["out"])
		);
	}
	return {
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
		devtool: PRODUCTION ? false : "source-map",
		resolve: {
			extensions: [".ts", ".tsx", ".js"]
		},
		output: {
			path: path.join(__dirname, "out"),
			filename: PRODUCTION ? "scripts.[chunkhash:10].js" : "scripts.js"
		},
		plugins
	};
};
