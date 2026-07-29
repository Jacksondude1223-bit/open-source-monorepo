/* eslint-disable @next/next/no-img-element */
import { useUser } from '~/components/contexts/user';
import { useWorkspace } from '~/components/contexts/workspace';
import { ReactElement, useState } from 'react';
import LoadingPage from '~/components/layouts/LoadingPage';
import PageHeading from '~/components/layouts/PageHeading';
import { useRouter } from 'next/router';
import Button from '~/components/forms/Button';
import { trpc } from '~/utils/trpc';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { ArrowPathIcon, ClipboardIcon, ArrowDownTrayIcon, EyeIcon, EyeSlashIcon } from '@heroicons/react/20/solid';
import WorkspaceUpsale from '~/components/page_components/workspaces/settings/billing/Upsale';
import SettingsLayout from '~/components/page_components/workspaces/settings/SettingsLayout';
import Card from '~/components/ui/Card';
import Header from '~/components/NextGenStyles/Header';
import Toggle from '~/components/forms/Toggle';

export default function DashboardPage() {
  const router = useRouter();
  const { groupId }: { groupId: string } = router.query as any;
  const user = useUser();
  const workspace = useWorkspace();
  const context = trpc.useUtils();
  const [mouseInLoaderIdBox, setMouseInLoaderIdBox] = useState(false);
  const [showingLoaderId, setShowingLoaderId] = useState(false);
  const mutation = trpc.workspaces.workspace.settings.resetLoaderId.useMutation();
  const updateAppCenterMutation = trpc.workspaces.workspace.settings.remoteAdmin.updateApplicationCenterSettings.useMutation();
  if (!user || !workspace) {
    return <LoadingPage />;
  }
  function resetLoaderId() {
    mutation.mutateAsync({ groupId }).then(() => {
      toast.success('Successfully reset loader ID')
      context.workspaces.workspace.getWorkspace.invalidate({ groupId })
    }).catch(e => {
      toast.error(e)
    })
  }

  // Persist the Application Center workspace settings. Each control passes only
  // the field it changed; the rest fall back to the current saved values. The
  // in-game tracker reads these from the createServer response and loads (or
  // skips) the embedded Application Center accordingly.
  const appCenterSettings = workspace.applicationCenterSettings;
  async function saveApplicationCenter(next: { enabled?: boolean; displayMode?: 'windowed' | 'fullscreen'; backdrop?: boolean }) {
    await toast.promise(
      updateAppCenterMutation.mutateAsync({
        groupId,
        enabled: next.enabled ?? appCenterSettings?.enabled ?? false,
        displayMode: next.displayMode ?? appCenterSettings?.displayMode ?? 'windowed',
        backdrop: next.backdrop ?? appCenterSettings?.backdrop ?? false,
      }),
      {
        loading: 'Saving Application Center settings...',
        success: 'Application Center settings saved!',
        error: (err: any) => `Failed to save: ${err.message}`,
      },
    );
    context.workspaces.workspace.getWorkspace.invalidate({ groupId });
  }

  function downloadApplicationCenter() {

const appCenter = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
	<External>null</External>
	<External>nil</External>
	<Item class="Workspace" referent="RBXe8ade3d9305f4f4886a108b16645ab5b">
		<Properties>
			<float name="AirDensity">0.00120000006</float>
			<float name="AirTurbulenceIntensity">0</float>
			<bool name="AllowThirdPartySales">false</bool>
			<token name="AuthorityMode">1</token>
			<token name="AvatarUnificationMode">0</token>
			<token name="ClientAnimatorThrottling">0</token>
			<BinaryString name="CollisionGroupData">AQEABP////8HRGVmYXVsdA==</BinaryString>
			<Ref name="CurrentCamera">RBX4e70bc70090745469fdb10cd3e269755</Ref>
			<double name="DistributedGameTime">0</double>
			<token name="EnableSLIMAvatars">0</token>
			<bool name="ExplicitAutoJoints">true</bool>
			<bool name="FallHeightEnabled">true</bool>
			<float name="FallenPartsDestroyHeight">-500</float>
			<token name="FluidForces">0</token>
			<Vector3 name="GlobalWind">
				<X>0</X>
				<Y>0</Y>
				<Z>0</Z>
			</Vector3>
			<float name="Gravity">196.199997</float>
			<token name="IKControlConstraintSupport">0</token>
			<token name="ImprovedAnimationConstraint">0</token>
			<token name="LayeredClothingCacheOptimizations">0</token>
			<token name="LuauTypeCheckMode">0</token>
			<token name="MeshPartHeadsAndAccessories">0</token>
			<token name="MeshStreamingAndImprovedLods">0</token>
			<token name="ModelStreamingBehavior">0</token>
			<token name="NextGenerationReplication">0</token>
			<token name="PathfindingUseImprovedSearch">0</token>
			<token name="PhysicsImprovedSleep">0</token>
			<token name="PhysicsSteppingMethod">0</token>
			<token name="PlayerCharacterDestroyBehavior">0</token>
			<token name="PlayerScriptsUseInputActionSystem">0</token>
			<token name="PrimalPhysicsSolver">0</token>
			<token name="RejectCharacterDeletions">0</token>
			<token name="RenderingCacheOptimizations">0</token>
			<token name="ReplicateInstanceDestroySetting">0</token>
			<token name="Retargeting">0</token>
			<token name="SandboxedInstanceMode">0</token>
			<token name="SignalBehavior2">2</token>
			<token name="StreamOutBehavior">2</token>
			<bool name="StreamingEnabled">true</bool>
			<token name="StreamingIntegrityMode">3</token>
			<int name="StreamingMinRadius">64</int>
			<int name="StreamingTargetRadius">1024</int>
			<bool name="TerrainWeldsFixed">true</bool>
			<token name="TouchEventsUseCollisionGroups">0</token>
			<bool name="TouchesUseCollisionGroups">false</bool>
			<token name="UseFixedSimulation">0</token>
			<token name="UseNewLuauTypeSolver">2</token>
			<token name="ValidateEnabledProximityPrompt">0</token>
			<token name="LevelOfDetail">0</token>
			<CoordinateFrame name="ModelMeshCFrame">
				<X>0</X>
				<Y>0</Y>
				<Z>0</Z>
				<R00>1</R00>
				<R01>0</R01>
				<R02>0</R02>
				<R10>0</R10>
				<R11>1</R11>
				<R12>0</R12>
				<R20>0</R20>
				<R21>0</R21>
				<R22>1</R22>
			</CoordinateFrame>
			<SharedString name="ModelMeshData">yuZpQdnvvUBOTYh1jqZ2cA==</SharedString>
			<Vector3 name="ModelMeshSize">
				<X>0</X>
				<Y>0</Y>
				<Z>0</Z>
			</Vector3>
			<token name="ModelStreamingMode">0</token>
			<bool name="NeedsPivotMigration">false</bool>
			<Ref name="PrimaryPart">null</Ref>
			<float name="ScaleFactor">1</float>
			<SharedString name="SlimHash">yuZpQdnvvUBOTYh1jqZ2cA==</SharedString>
			<OptionalCoordinateFrame name="WorldPivotData">
				<CFrame>
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CFrame>
			</OptionalCoordinateFrame>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Workspace</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000002</UniqueId>
		</Properties>
		<Item class="Camera" referent="RBX4e70bc70090745469fdb10cd3e269755">
			<Properties>
				<CoordinateFrame name="CFrame">
					<X>-15.6231079</X>
					<Y>18.8032608</Y>
					<Z>-32.9498138</Z>
					<R00>-0.706150949</R00>
					<R01>0.312966108</R01>
					<R02>-0.635140359</R02>
					<R10>-1.49011612e-08</R10>
					<R11>0.897013187</R11>
					<R12>0.442004144</R12>
					<R20>0.708061457</R20>
					<R21>0.31212166</R21>
					<R22>-0.633426607</R22>
				</CoordinateFrame>
				<Ref name="CameraSubject">null</Ref>
				<token name="CameraType">0</token>
				<float name="FieldOfView">70</float>
				<token name="FieldOfViewMode">0</token>
				<CoordinateFrame name="Focus">
					<X>-14.3528271</X>
					<Y>17.9192524</Y>
					<Z>-31.6829605</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<bool name="HeadLocked">true</bool>
				<float name="HeadScale">1</float>
				<bool name="VRTiltAndRollEnabled">false</bool>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">Camera</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b6</UniqueId>
			</Properties>
		</Item>
		<Item class="Part" referent="RBX15093d4422bb4277a2ff8d29e8bdf737">
			<Properties>
				<token name="shape">1</token>
				<token name="formFactorRaw">0</token>
				<bool name="Anchored">true</bool>
				<bool name="AudioCanCollide">true</bool>
				<float name="BackParamA">-0.5</float>
				<float name="BackParamB">0.5</float>
				<token name="BackSurface">0</token>
				<token name="BackSurfaceInput">0</token>
				<float name="BottomParamA">-0.5</float>
				<float name="BottomParamB">0.5</float>
				<token name="BottomSurface">0</token>
				<token name="BottomSurfaceInput">0</token>
				<CoordinateFrame name="CFrame">
					<X>0</X>
					<Y>-8</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<bool name="CanCollide">true</bool>
				<bool name="CanQuery">true</bool>
				<bool name="CanTouch">true</bool>
				<bool name="CastShadow">true</bool>
				<string name="CollisionGroup">Default</string>
				<int name="CollisionGroupId">0</int>
				<Color3uint8 name="Color3uint8">4284177243</Color3uint8>
				<PhysicalProperties name="CustomPhysicalProperties">
					<CustomPhysics>false</CustomPhysics>
				</PhysicalProperties>
				<bool name="EnableFluidForces">true</bool>
				<float name="FrontParamA">-0.5</float>
				<float name="FrontParamB">0.5</float>
				<token name="FrontSurface">0</token>
				<token name="FrontSurfaceInput">0</token>
				<float name="LeftParamA">-0.5</float>
				<float name="LeftParamB">0.5</float>
				<token name="LeftSurface">0</token>
				<token name="LeftSurfaceInput">0</token>
				<bool name="Locked">true</bool>
				<bool name="Massless">false</bool>
				<token name="Material">256</token>
				<string name="MaterialVariantSerialized"></string>
				<CoordinateFrame name="PivotOffset">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<float name="Reflectance">0</float>
				<float name="RightParamA">-0.5</float>
				<float name="RightParamB">0.5</float>
				<token name="RightSurface">0</token>
				<token name="RightSurfaceInput">0</token>
				<int name="RootPriority">0</int>
				<Vector3 name="RotVelocity">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<float name="TopParamA">-0.5</float>
				<float name="TopParamB">0.5</float>
				<token name="TopSurface">0</token>
				<token name="TopSurfaceInput">0</token>
				<float name="Transparency">0</float>
				<Vector3 name="Velocity">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<Vector3 name="size">
					<X>2048</X>
					<Y>16</Y>
					<Z>2048</Z>
				</Vector3>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">Baseplate</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b7</UniqueId>
			</Properties>
			<Item class="Texture" referent="RBX81473f5c06754046801530f0d2ff907c">
				<Properties>
					<float name="OffsetStudsU">0</float>
					<float name="OffsetStudsV">0</float>
					<float name="StudsPerTileU">8</float>
					<float name="StudsPerTileV">8</float>
					<Color3 name="Color3">
						<R>0</R>
						<G>0</G>
						<B>0</B>
					</Color3>
					<Content name="MetalnessMap"><null></null></Content>
					<Content name="NormalMap"><null></null></Content>
					<float name="Rotation">0</float>
					<Content name="RoughnessMap"><null></null></Content>
					<Content name="Texture"><url>rbxassetid://6372755229</url></Content>
					<Content name="TexturePack"><null></null></Content>
					<string name="TexturePackMetadata"></string>
					<float name="Transparency">0.800000012</float>
					<Vector2 name="UVOffset">
						<X>0</X>
						<Y>0</Y>
					</Vector2>
					<Vector2 name="UVScale">
						<X>1</X>
						<Y>1</Y>
					</Vector2>
					<int name="ZIndex">1</int>
					<token name="Face">1</token>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">Texture</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b8</UniqueId>
				</Properties>
			</Item>
		</Item>
		<Item class="Terrain" referent="RBX6f570ca5e64646eb91be050e0fe4298e">
			<Properties>
				<token name="AcquisitionMethod">0</token>
				<bool name="Decoration">true</bool>
				<float name="GrassLength">0.699999988</float>
				<BinaryString name="MaterialColors"><![CDATA[AAAAAAAAb34+WFlWmJiYimFJz8unrJRsY2Rm3eTl6/3/lHxfeXBiS0pKjIJo/xhDUFRUhoZ2
zNLfaoZA///+//PAj5CH]]></BinaryString>
				<SharedString name="Materials">yuZpQdnvvUBOTYh1jqZ2cA==</SharedString>
				<BinaryString name="PhysicsGrid">AgMAAAAAAAAAAAAAAAA=</BinaryString>
				<BinaryString name="SmoothGrid">AQU=</BinaryString>
				<bool name="SmoothVoxelsUpgraded">false</bool>
				<Color3 name="WaterColor">
					<R>0.0470588282</R>
					<G>0.329411775</G>
					<B>0.360784322</B>
				</Color3>
				<float name="WaterReflectance">1</float>
				<float name="WaterTransparency">0.300000012</float>
				<float name="WaterWaveSize">0.150000006</float>
				<float name="WaterWaveSpeed">10</float>
				<bool name="Anchored">true</bool>
				<bool name="AudioCanCollide">true</bool>
				<float name="BackParamA">-0.5</float>
				<float name="BackParamB">0.5</float>
				<token name="BackSurface">0</token>
				<token name="BackSurfaceInput">0</token>
				<float name="BottomParamA">-0.5</float>
				<float name="BottomParamB">0.5</float>
				<token name="BottomSurface">4</token>
				<token name="BottomSurfaceInput">0</token>
				<CoordinateFrame name="CFrame">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<bool name="CanCollide">true</bool>
				<bool name="CanQuery">true</bool>
				<bool name="CanTouch">true</bool>
				<bool name="CastShadow">true</bool>
				<string name="CollisionGroup">Default</string>
				<int name="CollisionGroupId">0</int>
				<Color3uint8 name="Color3uint8">4288914085</Color3uint8>
				<PhysicalProperties name="CustomPhysicalProperties">
					<CustomPhysics>false</CustomPhysics>
				</PhysicalProperties>
				<bool name="EnableFluidForces">true</bool>
				<float name="FrontParamA">-0.5</float>
				<float name="FrontParamB">0.5</float>
				<token name="FrontSurface">0</token>
				<token name="FrontSurfaceInput">0</token>
				<float name="LeftParamA">-0.5</float>
				<float name="LeftParamB">0.5</float>
				<token name="LeftSurface">0</token>
				<token name="LeftSurfaceInput">0</token>
				<bool name="Locked">true</bool>
				<bool name="Massless">false</bool>
				<token name="Material">256</token>
				<string name="MaterialVariantSerialized"></string>
				<CoordinateFrame name="PivotOffset">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<float name="Reflectance">0</float>
				<float name="RightParamA">-0.5</float>
				<float name="RightParamB">0.5</float>
				<token name="RightSurface">0</token>
				<token name="RightSurfaceInput">0</token>
				<int name="RootPriority">0</int>
				<Vector3 name="RotVelocity">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<float name="TopParamA">-0.5</float>
				<float name="TopParamB">0.5</float>
				<token name="TopSurface">3</token>
				<token name="TopSurfaceInput">0</token>
				<float name="Transparency">0</float>
				<Vector3 name="Velocity">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<Vector3 name="size">
					<X>2044</X>
					<Y>252</Y>
					<Z>2044</Z>
				</Vector3>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">Terrain</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b9</UniqueId>
			</Properties>
		</Item>
		<Item class="SpawnLocation" referent="RBXb47aa40e07b04034b2b949b74b6b11ae">
			<Properties>
				<bool name="AllowTeamChangeOnTouch">false</bool>
				<int name="Duration">0</int>
				<bool name="Enabled">true</bool>
				<bool name="Neutral">true</bool>
				<int name="TeamColor">194</int>
				<token name="shape">1</token>
				<token name="formFactorRaw">1</token>
				<bool name="Anchored">true</bool>
				<bool name="AudioCanCollide">true</bool>
				<float name="BackParamA">-0.5</float>
				<float name="BackParamB">0.5</float>
				<token name="BackSurface">0</token>
				<token name="BackSurfaceInput">0</token>
				<float name="BottomParamA">-0.5</float>
				<float name="BottomParamB">0.5</float>
				<token name="BottomSurface">0</token>
				<token name="BottomSurfaceInput">0</token>
				<CoordinateFrame name="CFrame">
					<X>0</X>
					<Y>0.5</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<bool name="CanCollide">true</bool>
				<bool name="CanQuery">true</bool>
				<bool name="CanTouch">true</bool>
				<bool name="CastShadow">true</bool>
				<string name="CollisionGroup">Default</string>
				<int name="CollisionGroupId">0</int>
				<Color3uint8 name="Color3uint8">4288914085</Color3uint8>
				<PhysicalProperties name="CustomPhysicalProperties">
					<CustomPhysics>false</CustomPhysics>
				</PhysicalProperties>
				<bool name="EnableFluidForces">true</bool>
				<float name="FrontParamA">-0.5</float>
				<float name="FrontParamB">0.5</float>
				<token name="FrontSurface">0</token>
				<token name="FrontSurfaceInput">0</token>
				<float name="LeftParamA">-0.5</float>
				<float name="LeftParamB">0.5</float>
				<token name="LeftSurface">0</token>
				<token name="LeftSurfaceInput">0</token>
				<bool name="Locked">false</bool>
				<bool name="Massless">false</bool>
				<token name="Material">256</token>
				<string name="MaterialVariantSerialized"></string>
				<CoordinateFrame name="PivotOffset">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
					<R00>1</R00>
					<R01>0</R01>
					<R02>0</R02>
					<R10>0</R10>
					<R11>1</R11>
					<R12>0</R12>
					<R20>0</R20>
					<R21>0</R21>
					<R22>1</R22>
				</CoordinateFrame>
				<float name="Reflectance">0</float>
				<float name="RightParamA">-0.5</float>
				<float name="RightParamB">0.5</float>
				<token name="RightSurface">0</token>
				<token name="RightSurfaceInput">0</token>
				<int name="RootPriority">0</int>
				<Vector3 name="RotVelocity">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<float name="TopParamA">-0.5</float>
				<float name="TopParamB">0.5</float>
				<token name="TopSurface">0</token>
				<token name="TopSurfaceInput">0</token>
				<float name="Transparency">0</float>
				<Vector3 name="Velocity">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<Vector3 name="size">
					<X>12</X>
					<Y>1</Y>
					<Z>12</Z>
				</Vector3>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">SpawnLocation</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003ba</UniqueId>
			</Properties>
			<Item class="Decal" referent="RBXf859d3d7bd0341cf8633a5b4c9ec8433">
				<Properties>
					<Color3 name="Color3">
						<R>1</R>
						<G>1</G>
						<B>1</B>
					</Color3>
					<Content name="MetalnessMap"><null></null></Content>
					<Content name="NormalMap"><null></null></Content>
					<float name="Rotation">0</float>
					<Content name="RoughnessMap"><null></null></Content>
					<Content name="Texture"><url>rbxasset://textures/SpawnLocation.png</url></Content>
					<Content name="TexturePack"><null></null></Content>
					<string name="TexturePackMetadata"></string>
					<float name="Transparency">0</float>
					<Vector2 name="UVOffset">
						<X>0</X>
						<Y>0</Y>
					</Vector2>
					<Vector2 name="UVScale">
						<X>1</X>
						<Y>1</Y>
					</Vector2>
					<int name="ZIndex">1</int>
					<token name="Face">1</token>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">Decal</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003bb</UniqueId>
				</Properties>
			</Item>
		</Item>
	</Item>
	<Item class="TimerService" referent="RBX232cca0b593a4a0a93bdcc482807d46e">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Instance</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000336</UniqueId>
		</Properties>
	</Item>
	<Item class="CollectionService" referent="RBX6c6888cfbf2044558cfacd31b611ae86">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">CollectionService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000337</UniqueId>
		</Properties>
	</Item>
	<Item class="SoundService" referent="RBXf8fa568483714b949cf65e582dd6fda6">
		<Properties>
			<bool name="AcousticSimulationEnabled">false</bool>
			<token name="AmbientReverb">0</token>
			<token name="AudioApiByDefault">0</token>
			<token name="CharacterSoundsUseNewApi">0</token>
			<token name="DefaultListenerLocation">3</token>
			<float name="DistanceFactor">3.32999992</float>
			<float name="DopplerScale">1</float>
			<bool name="IsNewExpForAudioApiByDefault">false</bool>
			<bool name="RespectFilteringEnabled">true</bool>
			<float name="RolloffScale">1</float>
			<token name="VolumetricAudio">1</token>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">SoundService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000338</UniqueId>
		</Properties>
	</Item>
	<Item class="VideoCaptureService" referent="RBX440504fd1b364d939385e5532d3718d4">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">VideoCaptureService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000344</UniqueId>
		</Properties>
	</Item>
	<Item class="NonReplicatedCSGDictionaryService" referent="RBX899dae9217f1420bb8d1540135339b03">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">NonReplicatedCSGDictionaryService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000345</UniqueId>
		</Properties>
	</Item>
	<Item class="CSGDictionaryService" referent="RBX531bb14861d548aea7bdc9c1c0a41822">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">CSGDictionaryService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000346</UniqueId>
		</Properties>
	</Item>
	<Item class="Chat" referent="RBX284093c40572400eb6b462984a834660">
		<Properties>
			<bool name="BubbleChatEnabled">true</bool>
			<bool name="IsAutoMigrated">true</bool>
			<bool name="LoadDefaultChat">true</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Chat</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000034c</UniqueId>
		</Properties>
	</Item>
	<Item class="Players" referent="RBXa91bf52316ec482aa06a118bf49e5118">
		<Properties>
			<bool name="BanningEnabled">true</bool>
			<bool name="CharacterAutoLoads">true</bool>
			<int name="MaxPlayersInternal">30</int>
			<int name="PreferredPlayersInternal">30</int>
			<float name="RespawnTime">3</float>
			<bool name="UseStrafingAnimations">false</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Players</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000034e</UniqueId>
		</Properties>
	</Item>
	<Item class="ReplicatedFirst" referent="RBXbd00d376ce7c44339f74e8d8f4ff6634">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ReplicatedFirst</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000351</UniqueId>
		</Properties>
	</Item>
	<Item class="TweenService" referent="RBX8bbeffc4fb64495f81d5c08a48e08044">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">TweenService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000353</UniqueId>
		</Properties>
	</Item>
	<Item class="MaterialService" referent="RBXf01e7d3edb3c46bbb555c5ee69c6b150">
		<Properties>
			<string name="AsphaltName">Asphalt</string>
			<string name="BasaltName">Basalt</string>
			<string name="BrickName">Brick</string>
			<string name="CardboardName">Cardboard</string>
			<string name="CarpetName">Carpet</string>
			<string name="CeramicTilesName">CeramicTiles</string>
			<string name="ClayRoofTilesName">ClayRoofTiles</string>
			<string name="CobblestoneName">Cobblestone</string>
			<string name="ConcreteName">Concrete</string>
			<string name="CorrodedMetalName">CorrodedMetal</string>
			<string name="CrackedLavaName">CrackedLava</string>
			<string name="DiamondPlateName">DiamondPlate</string>
			<string name="FabricName">Fabric</string>
			<string name="FoilName">Foil</string>
			<string name="GlacierName">Glacier</string>
			<string name="GraniteName">Granite</string>
			<string name="GrassName">Grass</string>
			<string name="GroundName">Ground</string>
			<string name="IceName">Ice</string>
			<string name="LeafyGrassName">LeafyGrass</string>
			<string name="LeatherName">Leather</string>
			<string name="LimestoneName">Limestone</string>
			<string name="MarbleName">Marble</string>
			<string name="MetalName">Metal</string>
			<string name="MudName">Mud</string>
			<string name="PavementName">Pavement</string>
			<string name="PebbleName">Pebble</string>
			<string name="PlasterName">Plaster</string>
			<string name="PlasticName">Plastic</string>
			<string name="RockName">Rock</string>
			<string name="RoofShinglesName">RoofShingles</string>
			<string name="RubberName">Rubber</string>
			<string name="SaltName">Salt</string>
			<string name="SandName">Sand</string>
			<string name="SandstoneName">Sandstone</string>
			<string name="SlateName">Slate</string>
			<string name="SmoothPlasticName">SmoothPlastic</string>
			<string name="SnowName">Snow</string>
			<bool name="Use2022MaterialsXml">true</bool>
			<string name="WoodName">Wood</string>
			<string name="WoodPlanksName">WoodPlanks</string>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">MaterialService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000354</UniqueId>
		</Properties>
	</Item>
	<Item class="TextChatService" referent="RBX4ac4381e56b0408c98134795de624d51">
		<Properties>
			<bool name="ChatTranslationFTUXShown">true</bool>
			<bool name="ChatTranslationToggleEnabled">false</bool>
			<token name="ChatVersion">1</token>
			<bool name="CreateDefaultCommands">true</bool>
			<bool name="CreateDefaultTextChannels">true</bool>
			<bool name="HasSeenDeprecationDialog">false</bool>
			<bool name="IsLegacyChatDisabled">true</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">TextChatService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000355</UniqueId>
		</Properties>
		<Item class="ChatWindowConfiguration" referent="RBXa9a0aa1da0d6476c844c3dd97bfb4f1b">
			<Properties>
				<Color3 name="BackgroundColor3">
					<R>0.0980392173</R>
					<G>0.105882354</G>
					<B>0.113725491</B>
				</Color3>
				<double name="BackgroundTransparency">0.2999999999999999889</double>
				<bool name="Enabled">true</bool>
				<Font name="FontFace">
					<Family><url>rbxasset://fonts/families/BuilderSans.json</url></Family>
					<Weight>500</Weight>
					<Style>Normal</Style>
					<CachedFaceId><url>rbxasset://fonts/BuilderSans-Medium.otf</url></CachedFaceId>
				</Font>
				<float name="HeightScale">1</float>
				<token name="HorizontalAlignment">1</token>
				<Color3 name="TextColor3">
					<R>1</R>
					<G>1</G>
					<B>1</B>
				</Color3>
				<int64 name="TextSize">18</int64>
				<Color3 name="TextStrokeColor3">
					<R>0</R>
					<G>0</G>
					<B>0</B>
				</Color3>
				<double name="TextStrokeTransparency">0.5</double>
				<token name="VerticalAlignment">1</token>
				<float name="WidthScale">1</float>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">ChatWindowConfiguration</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c5</UniqueId>
			</Properties>
		</Item>
		<Item class="ChatInputBarConfiguration" referent="RBX30cff50531fe44399536ac7d1e10d5b8">
			<Properties>
				<bool name="AutocompleteEnabled">true</bool>
				<Color3 name="BackgroundColor3">
					<R>0.0980392173</R>
					<G>0.105882354</G>
					<B>0.113725491</B>
				</Color3>
				<double name="BackgroundTransparency">0.2000000000000000111</double>
				<bool name="Enabled">true</bool>
				<Font name="FontFace">
					<Family><url>rbxasset://fonts/families/BuilderSans.json</url></Family>
					<Weight>500</Weight>
					<Style>Normal</Style>
					<CachedFaceId><url>rbxasset://fonts/BuilderSans-Medium.otf</url></CachedFaceId>
				</Font>
				<token name="KeyboardKeyCode">47</token>
				<Color3 name="PlaceholderColor3">
					<R>0.698039234</R>
					<G>0.698039234</G>
					<B>0.698039234</B>
				</Color3>
				<Ref name="TargetTextChannel">null</Ref>
				<Color3 name="TextColor3">
					<R>1</R>
					<G>1</G>
					<B>1</B>
				</Color3>
				<int64 name="TextSize">18</int64>
				<Color3 name="TextStrokeColor3">
					<R>0</R>
					<G>0</G>
					<B>0</B>
				</Color3>
				<double name="TextStrokeTransparency">0.5</double>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">ChatInputBarConfiguration</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c6</UniqueId>
			</Properties>
		</Item>
		<Item class="BubbleChatConfiguration" referent="RBXd20e217a089a4eb7a38f0f72e0b78603">
			<Properties>
				<string name="AdorneeName">HumanoidRootPart</string>
				<Color3 name="BackgroundColor3">
					<R>0.980392158</R>
					<G>0.980392158</G>
					<B>0.980392158</B>
				</Color3>
				<double name="BackgroundTransparency">0.10000000000000000555</double>
				<float name="BubbleDuration">15</float>
				<float name="BubblesSpacing">6</float>
				<bool name="Enabled">true</bool>
				<token name="Font">47</token>
				<Font name="FontFace">
					<Family><url>rbxasset://fonts/families/BuilderSans.json</url></Family>
					<Weight>500</Weight>
					<Style>Normal</Style>
					<CachedFaceId><url>rbxasset://fonts/BuilderSans-Medium.otf</url></CachedFaceId>
				</Font>
				<Vector3 name="LocalPlayerStudsOffset">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<float name="MaxBubbles">3</float>
				<float name="MaxDistance">100</float>
				<float name="MinimizeDistance">40</float>
				<bool name="TailVisible">true</bool>
				<Color3 name="TextColor3">
					<R>0.223529413</R>
					<G>0.23137255</G>
					<B>0.239215687</B>
				</Color3>
				<int64 name="TextSize">20</int64>
				<float name="VerticalStudsOffset">0</float>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">BubbleChatConfiguration</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c7</UniqueId>
			</Properties>
			<Item class="UIGradient" referent="RBXeb24976041214717a01636374b9e6c9e">
				<Properties>
					<ColorSequence name="Color">0 1 1 1 0 1 1 1 1 0 </ColorSequence>
					<bool name="Enabled">false</bool>
					<Vector2 name="Offset">
						<X>0</X>
						<Y>0</Y>
					</Vector2>
					<float name="Rotation">0</float>
					<NumberSequence name="Transparency">0 0 0 1 0 0 </NumberSequence>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">UIGradient</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c8</UniqueId>
				</Properties>
			</Item>
			<Item class="ImageLabel" referent="RBX69008285127742398585fc8bc531126b">
				<Properties>
					<Content name="Image"><null></null></Content>
					<Color3 name="ImageColor3">
						<R>1</R>
						<G>1</G>
						<B>1</B>
					</Color3>
					<Vector2 name="ImageRectOffset">
						<X>0</X>
						<Y>0</Y>
					</Vector2>
					<Vector2 name="ImageRectSize">
						<X>0</X>
						<Y>0</Y>
					</Vector2>
					<float name="ImageTransparency">0</float>
					<token name="ResampleMode">0</token>
					<token name="ScaleType">0</token>
					<Rect2D name="SliceCenter">
						<min>
							<X>0</X>
							<Y>0</Y>
						</min>
						<max>
							<X>0</X>
							<Y>0</Y>
						</max>
					</Rect2D>
					<float name="SliceScale">1</float>
					<UDim2 name="TileSize">
						<XS>1</XS>
						<XO>0</XO>
						<YS>1</YS>
						<YO>0</YO>
					</UDim2>
					<bool name="Active">false</bool>
					<Vector2 name="AnchorPoint">
						<X>0</X>
						<Y>0</Y>
					</Vector2>
					<token name="AutomaticSize">0</token>
					<Color3 name="BackgroundColor3">
						<R>1</R>
						<G>1</G>
						<B>1</B>
					</Color3>
					<float name="BackgroundTransparency">0</float>
					<Color3 name="BorderColor3">
						<R>0.105882362</R>
						<G>0.164705887</G>
						<B>0.207843155</B>
					</Color3>
					<token name="BorderMode">0</token>
					<int name="BorderSizePixel">1</int>
					<bool name="ClipsDescendants">false</bool>
					<bool name="Draggable">false</bool>
					<token name="InputSink">0</token>
					<bool name="Interactable">true</bool>
					<int name="LayoutOrder">0</int>
					<Ref name="NextSelectionDown">null</Ref>
					<Ref name="NextSelectionLeft">null</Ref>
					<Ref name="NextSelectionRight">null</Ref>
					<Ref name="NextSelectionUp">null</Ref>
					<UDim2 name="Position">
						<XS>0</XS>
						<XO>0</XO>
						<YS>0</YS>
						<YO>0</YO>
					</UDim2>
					<float name="Rotation">0</float>
					<bool name="Selectable">false</bool>
					<Ref name="SelectionImageObject">null</Ref>
					<int name="SelectionOrder">0</int>
					<UDim2 name="Size">
						<XS>0</XS>
						<XO>100</XO>
						<YS>0</YS>
						<YO>100</YO>
					</UDim2>
					<token name="SizeConstraint">0</token>
					<bool name="Visible">true</bool>
					<int name="ZIndex">1</int>
					<bool name="AutoLocalize">true</bool>
					<Ref name="RootLocalizationTable">null</Ref>
					<token name="SelectionBehaviorDown">0</token>
					<token name="SelectionBehaviorLeft">0</token>
					<token name="SelectionBehaviorRight">0</token>
					<token name="SelectionBehaviorUp">0</token>
					<bool name="SelectionGroup">false</bool>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">ImageLabel</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c9</UniqueId>
				</Properties>
			</Item>
			<Item class="UICorner" referent="RBX7f086c7fa48b4d9eba56afd1f5f2cd61">
				<Properties>
					<UDim name="BottomLeftRadius">
						<S>0</S>
						<O>12</O>
					</UDim>
					<UDim name="BottomRightRadius">
						<S>0</S>
						<O>12</O>
					</UDim>
					<UDim name="TopLeftRadius">
						<S>0</S>
						<O>12</O>
					</UDim>
					<UDim name="TopRightRadius">
						<S>0</S>
						<O>12</O>
					</UDim>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">UICorner</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003ca</UniqueId>
				</Properties>
			</Item>
			<Item class="UIPadding" referent="RBX518a16bda12c4f5ea0b41edb91ce1095">
				<Properties>
					<UDim name="PaddingBottom">
						<S>0</S>
						<O>8</O>
					</UDim>
					<UDim name="PaddingLeft">
						<S>0</S>
						<O>8</O>
					</UDim>
					<UDim name="PaddingRight">
						<S>0</S>
						<O>8</O>
					</UDim>
					<UDim name="PaddingTop">
						<S>0</S>
						<O>8</O>
					</UDim>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">UIPadding</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003cb</UniqueId>
				</Properties>
			</Item>
		</Item>
		<Item class="ChannelTabsConfiguration" referent="RBXfd1c1a2a52ad47e595c9a1afb9c62156">
			<Properties>
				<Color3 name="BackgroundColor3">
					<R>0.0980392173</R>
					<G>0.105882354</G>
					<B>0.113725491</B>
				</Color3>
				<double name="BackgroundTransparency">0</double>
				<bool name="Enabled">false</bool>
				<Font name="FontFace">
					<Family><url>rbxasset://fonts/families/BuilderSans.json</url></Family>
					<Weight>700</Weight>
					<Style>Normal</Style>
					<CachedFaceId><url>rbxasset://fonts/BuilderSans-Bold.otf</url></CachedFaceId>
				</Font>
				<Color3 name="HoverBackgroundColor3">
					<R>0.490196079</R>
					<G>0.490196079</G>
					<B>0.490196079</B>
				</Color3>
				<Color3 name="SelectedTabTextColor3">
					<R>1</R>
					<G>1</G>
					<B>1</B>
				</Color3>
				<Color3 name="TextColor3">
					<R>0.686274529</R>
					<G>0.686274529</G>
					<B>0.686274529</B>
				</Color3>
				<int64 name="TextSize">18</int64>
				<Color3 name="TextStrokeColor3">
					<R>0</R>
					<G>0</G>
					<B>0</B>
				</Color3>
				<double name="TextStrokeTransparency">1</double>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">ChannelTabsConfiguration</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003cc</UniqueId>
			</Properties>
		</Item>
	</Item>
	<Item class="PermissionsService" referent="RBX3334a2256bd14071b68dec774d32e6e2">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">PermissionsService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000357</UniqueId>
		</Properties>
	</Item>
	<Item class="PlayerEmulatorService" referent="RBXf6e379a11c8f43adbe54e8aca0a1f067">
		<Properties>
			<bool name="CustomPoliciesEnabled">false</bool>
			<string name="EmulatedCountryCode"></string>
			<string name="EmulatedGameLocale"></string>
			<bool name="PlayerEmulationEnabled">false</bool>
			<bool name="PseudolocalizationEnabled">false</bool>
			<BinaryString name="SerializedEmulatedPolicyInfo"></BinaryString>
			<int name="TextElongationFactor">0</int>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">PlayerEmulatorService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000358</UniqueId>
		</Properties>
	</Item>
	<Item class="StudioData" referent="RBX57f020b3d9594ec3906fa0bf2767cfc4">
		<Properties>
			<bool name="EnableScriptCollabByDefaultOnLoad">false</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">StudioData</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000035b</UniqueId>
		</Properties>
	</Item>
	<Item class="StarterPlayer" referent="RBXe94b178b8d8742cd9d0bbb8dbfb86848">
		<Properties>
			<bool name="AllowCustomAnimations">true</bool>
			<bool name="AutoJumpEnabled">true</bool>
			<token name="AvatarJointUpgrade_SerializedRollout">2</token>
			<float name="CameraMaxZoomDistance">128</float>
			<float name="CameraMinZoomDistance">0.5</float>
			<token name="CameraMode">0</token>
			<bool name="CharacterBreakJointsOnDeath">false</bool>
			<float name="CharacterJumpHeight">7.19999981</float>
			<float name="CharacterJumpPower">50</float>
			<float name="CharacterMaxSlopeAngle">89</float>
			<bool name="CharacterUseJumpPower">false</bool>
			<float name="CharacterWalkSpeed">16</float>
			<bool name="ClassicDeath">true</bool>
			<bool name="CreateDefaultPlayerModule">true</bool>
			<token name="DevCameraOcclusionMode">0</token>
			<token name="DevComputerCameraMovementMode">0</token>
			<token name="DevComputerMovementMode">0</token>
			<token name="DevTouchCameraMovementMode">0</token>
			<token name="DevTouchMovementMode">0</token>
			<token name="EnableDynamicHeads">0</token>
			<bool name="EnableMouseLockOption">true</bool>
			<int64 name="GameSettingsAssetIDFace">0</int64>
			<int64 name="GameSettingsAssetIDHead">0</int64>
			<int64 name="GameSettingsAssetIDLeftArm">0</int64>
			<int64 name="GameSettingsAssetIDLeftLeg">0</int64>
			<int64 name="GameSettingsAssetIDPants">0</int64>
			<int64 name="GameSettingsAssetIDRightArm">0</int64>
			<int64 name="GameSettingsAssetIDRightLeg">0</int64>
			<int64 name="GameSettingsAssetIDShirt">0</int64>
			<int64 name="GameSettingsAssetIDTeeShirt">0</int64>
			<int64 name="GameSettingsAssetIDTorso">0</int64>
			<token name="GameSettingsAvatar">1</token>
			<token name="GameSettingsR15Collision">0</token>
			<NumberRange name="GameSettingsScaleRangeBodyType">0 1 </NumberRange>
			<NumberRange name="GameSettingsScaleRangeHead">0.95 1 </NumberRange>
			<NumberRange name="GameSettingsScaleRangeHeight">0.9 1.05 </NumberRange>
			<NumberRange name="GameSettingsScaleRangeProportion">0 1 </NumberRange>
			<NumberRange name="GameSettingsScaleRangeWidth">0.7 1 </NumberRange>
			<float name="HealthDisplayDistance">100</float>
			<bool name="LoadCharacterAppearance">true</bool>
			<token name="LoadCharacterLayeredClothing">0</token>
			<token name="LuaCharacterController">0</token>
			<float name="NameDisplayDistance">100</float>
			<bool name="UserEmotesEnabled">true</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">StarterPlayer</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000035d</UniqueId>
		</Properties>
		<Item class="StarterPlayerScripts" referent="RBX54075ca7f0f94819a5460e49bea873a0">
			<Properties>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">StarterPlayerScripts</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003bd</UniqueId>
			</Properties>
		</Item>
		<Item class="StarterCharacterScripts" referent="RBX1e051e86d0194e07ad25b178ca88a0ca">
			<Properties>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">StarterCharacterScripts</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003be</UniqueId>
			</Properties>
		</Item>
	</Item>
	<Item class="StarterPack" referent="RBXd3ee87724445438f8b0f24a9f24b7585">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">StarterPack</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000035e</UniqueId>
		</Properties>
	</Item>
	<Item class="StarterGui" referent="RBXd3afbee7247741e581dba3c88cbe75a8">
		<Properties>
			<token name="ClipsDescendantsSupportsRotation">0</token>
			<bool name="ResetPlayerGuiOnSpawn">true</bool>
			<token name="RtlTextSupport">0</token>
			<token name="ScreenOrientation">4</token>
			<bool name="ShowDevelopmentGui">true</bool>
			<Ref name="StudioDefaultStyleSheet">null</Ref>
			<Ref name="StudioInsertWidgetLayerCollectorAutoLinkStyleSheet">null</Ref>
			<token name="VirtualCursorMode">0</token>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">StarterGui</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000035f</UniqueId>
		</Properties>
		<Item class="ScreenGui" referent="RBXea95807ee2754cc382b9af8d5e67fdee">
			<Properties>
				<bool name="ClipToDeviceSafeArea">true</bool>
				<int name="DisplayOrder">0</int>
				<token name="SafeAreaCompatibility">1</token>
				<token name="ScreenInsets">2</token>
				<bool name="Enabled">true</bool>
				<bool name="ResetOnSpawn">true</bool>
				<bool name="TabKeyboardNavigation">false</bool>
				<token name="ZIndexBehavior">1</token>
				<bool name="AutoLocalize">true</bool>
				<Ref name="RootLocalizationTable">null</Ref>
				<token name="SelectionBehaviorDown">0</token>
				<token name="SelectionBehaviorLeft">0</token>
				<token name="SelectionBehaviorRight">0</token>
				<token name="SelectionBehaviorUp">0</token>
				<bool name="SelectionGroup">false</bool>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">ScreenGui</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000a5e</UniqueId>
			</Properties>
			<Item class="Frame" referent="RBX726fe35f00434a9887bdb2de609864cd">
				<Properties>
					<token name="Style">0</token>
					<bool name="Active">false</bool>
					<Vector2 name="AnchorPoint">
						<X>0</X>
						<Y>0</Y>
					</Vector2>
					<token name="AutomaticSize">0</token>
					<Color3 name="BackgroundColor3">
						<R>1</R>
						<G>1</G>
						<B>1</B>
					</Color3>
					<float name="BackgroundTransparency">0</float>
					<Color3 name="BorderColor3">
						<R>0</R>
						<G>0</G>
						<B>0</B>
					</Color3>
					<token name="BorderMode">0</token>
					<int name="BorderSizePixel">0</int>
					<bool name="ClipsDescendants">false</bool>
					<bool name="Draggable">false</bool>
					<token name="InputSink">0</token>
					<bool name="Interactable">true</bool>
					<int name="LayoutOrder">0</int>
					<Ref name="NextSelectionDown">null</Ref>
					<Ref name="NextSelectionLeft">null</Ref>
					<Ref name="NextSelectionRight">null</Ref>
					<Ref name="NextSelectionUp">null</Ref>
					<UDim2 name="Position">
						<XS>0</XS>
						<XO>0</XO>
						<YS>0</YS>
						<YO>0</YO>
					</UDim2>
					<float name="Rotation">0</float>
					<bool name="Selectable">false</bool>
					<Ref name="SelectionImageObject">null</Ref>
					<int name="SelectionOrder">0</int>
					<UDim2 name="Size">
						<XS>1</XS>
						<XO>0</XO>
						<YS>1</YS>
						<YO>0</YO>
					</UDim2>
					<token name="SizeConstraint">0</token>
					<bool name="Visible">true</bool>
					<int name="ZIndex">1</int>
					<bool name="AutoLocalize">true</bool>
					<Ref name="RootLocalizationTable">null</Ref>
					<token name="SelectionBehaviorDown">0</token>
					<token name="SelectionBehaviorLeft">0</token>
					<token name="SelectionBehaviorRight">0</token>
					<token name="SelectionBehaviorUp">0</token>
					<bool name="SelectionGroup">false</bool>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">Frame</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000aa3</UniqueId>
				</Properties>
				<Item class="Frame" referent="RBX8374c5658db04ddbad70896752972b8e">
					<Properties>
						<token name="Style">0</token>
						<bool name="Active">false</bool>
						<Vector2 name="AnchorPoint">
							<X>0</X>
							<Y>0</Y>
						</Vector2>
						<token name="AutomaticSize">0</token>
						<Color3 name="BackgroundColor3">
							<R>0</R>
							<G>0.611764729</G>
							<B>1</B>
						</Color3>
						<float name="BackgroundTransparency">0</float>
						<Color3 name="BorderColor3">
							<R>0</R>
							<G>0</G>
							<B>0</B>
						</Color3>
						<token name="BorderMode">0</token>
						<int name="BorderSizePixel">0</int>
						<bool name="ClipsDescendants">false</bool>
						<bool name="Draggable">false</bool>
						<token name="InputSink">0</token>
						<bool name="Interactable">true</bool>
						<int name="LayoutOrder">0</int>
						<Ref name="NextSelectionDown">null</Ref>
						<Ref name="NextSelectionLeft">null</Ref>
						<Ref name="NextSelectionRight">null</Ref>
						<Ref name="NextSelectionUp">null</Ref>
						<UDim2 name="Position">
							<XS>0</XS>
							<XO>0</XO>
							<YS>0</YS>
							<YO>0</YO>
						</UDim2>
						<float name="Rotation">0</float>
						<bool name="Selectable">false</bool>
						<Ref name="SelectionImageObject">null</Ref>
						<int name="SelectionOrder">0</int>
						<UDim2 name="Size">
							<XS>1</XS>
							<XO>0</XO>
							<YS>0</YS>
							<YO>100</YO>
						</UDim2>
						<token name="SizeConstraint">0</token>
						<bool name="Visible">true</bool>
						<int name="ZIndex">1</int>
						<bool name="AutoLocalize">true</bool>
						<Ref name="RootLocalizationTable">null</Ref>
						<token name="SelectionBehaviorDown">0</token>
						<token name="SelectionBehaviorLeft">0</token>
						<token name="SelectionBehaviorRight">0</token>
						<token name="SelectionBehaviorUp">0</token>
						<bool name="SelectionGroup">false</bool>
						<BinaryString name="AttributesSerialize"></BinaryString>
						<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
						<bool name="DefinesCapabilities">false</bool>
						<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
						<string name="Name">header</string>
						<int64 name="SourceAssetId">-1</int64>
						<BinaryString name="Tags"></BinaryString>
						<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000ac4</UniqueId>
					</Properties>
					<Item class="TextLabel" referent="RBX1b2e806c69da4c119eb2de4d63296717">
						<Properties>
							<Font name="FontFace">
								<Family><url>rbxasset://fonts/families/SourceSansPro.json</url></Family>
								<Weight>700</Weight>
								<Style>Normal</Style>
							</Font>
							<float name="LineHeight">1</float>
							<string name="LocalizationMatchIdentifier"></string>
							<string name="LocalizationMatchedSourceText"></string>
							<int name="MaxVisibleGraphemes">-1</int>
							<string name="OpenTypeFeatures"></string>
							<bool name="RichText">false</bool>
							<string name="Text">Welcome to your ReAdmin application center!</string>
							<Color3 name="TextColor3">
								<R>1</R>
								<G>1</G>
								<B>1</B>
							</Color3>
							<token name="TextDirection">0</token>
							<bool name="TextScaled">true</bool>
							<float name="TextSize">14</float>
							<Color3 name="TextStrokeColor3">
								<R>0</R>
								<G>0</G>
								<B>0</B>
							</Color3>
							<float name="TextStrokeTransparency">1</float>
							<float name="TextTransparency">0</float>
							<token name="TextTruncate">0</token>
							<bool name="TextWrapped">true</bool>
							<token name="TextXAlignment">0</token>
							<token name="TextYAlignment">1</token>
							<bool name="Active">false</bool>
							<Vector2 name="AnchorPoint">
								<X>0</X>
								<Y>0</Y>
							</Vector2>
							<token name="AutomaticSize">0</token>
							<Color3 name="BackgroundColor3">
								<R>1</R>
								<G>1</G>
								<B>1</B>
							</Color3>
							<float name="BackgroundTransparency">1</float>
							<Color3 name="BorderColor3">
								<R>0</R>
								<G>0</G>
								<B>0</B>
							</Color3>
							<token name="BorderMode">0</token>
							<int name="BorderSizePixel">0</int>
							<bool name="ClipsDescendants">false</bool>
							<bool name="Draggable">false</bool>
							<token name="InputSink">0</token>
							<bool name="Interactable">true</bool>
							<int name="LayoutOrder">0</int>
							<Ref name="NextSelectionDown">null</Ref>
							<Ref name="NextSelectionLeft">null</Ref>
							<Ref name="NextSelectionRight">null</Ref>
							<Ref name="NextSelectionUp">null</Ref>
							<UDim2 name="Position">
								<XS>0.249666229</XS>
								<XO>0</XO>
								<YS>0.100000001</YS>
								<YO>0</YO>
							</UDim2>
							<float name="Rotation">0</float>
							<bool name="Selectable">false</bool>
							<Ref name="SelectionImageObject">null</Ref>
							<int name="SelectionOrder">0</int>
							<UDim2 name="Size">
								<XS>0.5</XS>
								<XO>0</XO>
								<YS>0.425000012</YS>
								<YO>0</YO>
							</UDim2>
							<token name="SizeConstraint">0</token>
							<bool name="Visible">true</bool>
							<int name="ZIndex">1</int>
							<bool name="AutoLocalize">true</bool>
							<Ref name="RootLocalizationTable">null</Ref>
							<token name="SelectionBehaviorDown">0</token>
							<token name="SelectionBehaviorLeft">0</token>
							<token name="SelectionBehaviorRight">0</token>
							<token name="SelectionBehaviorUp">0</token>
							<bool name="SelectionGroup">false</bool>
							<BinaryString name="AttributesSerialize"></BinaryString>
							<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
							<bool name="DefinesCapabilities">false</bool>
							<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
							<string name="Name">title</string>
							<int64 name="SourceAssetId">-1</int64>
							<BinaryString name="Tags"></BinaryString>
							<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000f92</UniqueId>
						</Properties>
					</Item>
					<Item class="TextLabel" referent="RBX5b16e5d8bdae45db8e359dedb541a79a">
						<Properties>
							<Font name="FontFace">
								<Family><url>rbxasset://fonts/families/SourceSansPro.json</url></Family>
								<Weight>400</Weight>
								<Style>Italic</Style>
							</Font>
							<float name="LineHeight">1</float>
							<string name="LocalizationMatchIdentifier"></string>
							<string name="LocalizationMatchedSourceText"></string>
							<int name="MaxVisibleGraphemes">-1</int>
							<string name="OpenTypeFeatures"></string>
							<bool name="RichText">false</bool>
							<string name="Text">All you need to do is publish this game to start receiving applications.</string>
							<Color3 name="TextColor3">
								<R>1</R>
								<G>1</G>
								<B>1</B>
							</Color3>
							<token name="TextDirection">0</token>
							<bool name="TextScaled">true</bool>
							<float name="TextSize">14</float>
							<Color3 name="TextStrokeColor3">
								<R>0</R>
								<G>0</G>
								<B>0</B>
							</Color3>
							<float name="TextStrokeTransparency">1</float>
							<float name="TextTransparency">0</float>
							<token name="TextTruncate">0</token>
							<bool name="TextWrapped">true</bool>
							<token name="TextXAlignment">0</token>
							<token name="TextYAlignment">1</token>
							<bool name="Active">false</bool>
							<Vector2 name="AnchorPoint">
								<X>0</X>
								<Y>0</Y>
							</Vector2>
							<token name="AutomaticSize">0</token>
							<Color3 name="BackgroundColor3">
								<R>1</R>
								<G>1</G>
								<B>1</B>
							</Color3>
							<float name="BackgroundTransparency">1</float>
							<Color3 name="BorderColor3">
								<R>0</R>
								<G>0</G>
								<B>0</B>
							</Color3>
							<token name="BorderMode">0</token>
							<int name="BorderSizePixel">0</int>
							<bool name="ClipsDescendants">false</bool>
							<bool name="Draggable">false</bool>
							<token name="InputSink">0</token>
							<bool name="Interactable">true</bool>
							<int name="LayoutOrder">0</int>
							<Ref name="NextSelectionDown">null</Ref>
							<Ref name="NextSelectionLeft">null</Ref>
							<Ref name="NextSelectionRight">null</Ref>
							<Ref name="NextSelectionUp">null</Ref>
							<UDim2 name="Position">
								<XS>0.249666229</XS>
								<XO>0</XO>
								<YS>0.524999976</YS>
								<YO>0</YO>
							</UDim2>
							<float name="Rotation">0</float>
							<bool name="Selectable">false</bool>
							<Ref name="SelectionImageObject">null</Ref>
							<int name="SelectionOrder">0</int>
							<UDim2 name="Size">
								<XS>0.5</XS>
								<XO>0</XO>
								<YS>0.375</YS>
								<YO>0</YO>
							</UDim2>
							<token name="SizeConstraint">0</token>
							<bool name="Visible">true</bool>
							<int name="ZIndex">1</int>
							<bool name="AutoLocalize">true</bool>
							<Ref name="RootLocalizationTable">null</Ref>
							<token name="SelectionBehaviorDown">0</token>
							<token name="SelectionBehaviorLeft">0</token>
							<token name="SelectionBehaviorRight">0</token>
							<token name="SelectionBehaviorUp">0</token>
							<bool name="SelectionGroup">false</bool>
							<BinaryString name="AttributesSerialize"></BinaryString>
							<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
							<bool name="DefinesCapabilities">false</bool>
							<UniqueId name="HistoryId">6e834dae133f2d660a307b2b00000f92</UniqueId>
							<string name="Name">subtitle</string>
							<int64 name="SourceAssetId">-1</int64>
							<BinaryString name="Tags"></BinaryString>
							<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000011ab</UniqueId>
						</Properties>
					</Item>
				</Item>
				<Item class="Frame" referent="RBXce34b3faa9f443d5a145e60877a7acf1">
					<Properties>
						<token name="Style">0</token>
						<bool name="Active">false</bool>
						<Vector2 name="AnchorPoint">
							<X>0</X>
							<Y>0</Y>
						</Vector2>
						<token name="AutomaticSize">0</token>
						<Color3 name="BackgroundColor3">
							<R>0</R>
							<G>0.611764729</G>
							<B>1</B>
						</Color3>
						<float name="BackgroundTransparency">0</float>
						<Color3 name="BorderColor3">
							<R>0</R>
							<G>0</G>
							<B>0</B>
						</Color3>
						<token name="BorderMode">0</token>
						<int name="BorderSizePixel">0</int>
						<bool name="ClipsDescendants">false</bool>
						<bool name="Draggable">false</bool>
						<token name="InputSink">0</token>
						<bool name="Interactable">true</bool>
						<int name="LayoutOrder">0</int>
						<Ref name="NextSelectionDown">null</Ref>
						<Ref name="NextSelectionLeft">null</Ref>
						<Ref name="NextSelectionRight">null</Ref>
						<Ref name="NextSelectionUp">null</Ref>
						<UDim2 name="Position">
							<XS>0</XS>
							<XO>0</XO>
							<YS>1</YS>
							<YO>-20</YO>
						</UDim2>
						<float name="Rotation">0</float>
						<bool name="Selectable">false</bool>
						<Ref name="SelectionImageObject">null</Ref>
						<int name="SelectionOrder">0</int>
						<UDim2 name="Size">
							<XS>1</XS>
							<XO>0</XO>
							<YS>0</YS>
							<YO>20</YO>
						</UDim2>
						<token name="SizeConstraint">0</token>
						<bool name="Visible">true</bool>
						<int name="ZIndex">1</int>
						<bool name="AutoLocalize">true</bool>
						<Ref name="RootLocalizationTable">null</Ref>
						<token name="SelectionBehaviorDown">0</token>
						<token name="SelectionBehaviorLeft">0</token>
						<token name="SelectionBehaviorRight">0</token>
						<token name="SelectionBehaviorUp">0</token>
						<bool name="SelectionGroup">false</bool>
						<BinaryString name="AttributesSerialize"></BinaryString>
						<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
						<bool name="DefinesCapabilities">false</bool>
						<UniqueId name="HistoryId">6e834dae133f2d660a307b2b00000ac4</UniqueId>
						<string name="Name">footer</string>
						<int64 name="SourceAssetId">-1</int64>
						<BinaryString name="Tags"></BinaryString>
						<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000adb</UniqueId>
					</Properties>
				</Item>
				<Item class="Frame" referent="RBX158b7cd20c4241bd87ed3d1389b98556">
					<Properties>
						<token name="Style">0</token>
						<bool name="Active">false</bool>
						<Vector2 name="AnchorPoint">
							<X>0</X>
							<Y>0</Y>
						</Vector2>
						<token name="AutomaticSize">0</token>
						<Color3 name="BackgroundColor3">
							<R>1</R>
							<G>1</G>
							<B>1</B>
						</Color3>
						<float name="BackgroundTransparency">0</float>
						<Color3 name="BorderColor3">
							<R>0</R>
							<G>0</G>
							<B>0</B>
						</Color3>
						<token name="BorderMode">0</token>
						<int name="BorderSizePixel">0</int>
						<bool name="ClipsDescendants">false</bool>
						<bool name="Draggable">false</bool>
						<token name="InputSink">0</token>
						<bool name="Interactable">true</bool>
						<int name="LayoutOrder">0</int>
						<Ref name="NextSelectionDown">null</Ref>
						<Ref name="NextSelectionLeft">null</Ref>
						<Ref name="NextSelectionRight">null</Ref>
						<Ref name="NextSelectionUp">null</Ref>
						<UDim2 name="Position">
							<XS>0</XS>
							<XO>0</XO>
							<YS>0</YS>
							<YO>100</YO>
						</UDim2>
						<float name="Rotation">0</float>
						<bool name="Selectable">false</bool>
						<Ref name="SelectionImageObject">null</Ref>
						<int name="SelectionOrder">0</int>
						<UDim2 name="Size">
							<XS>1</XS>
							<XO>0</XO>
							<YS>1</YS>
							<YO>-120</YO>
						</UDim2>
						<token name="SizeConstraint">0</token>
						<bool name="Visible">true</bool>
						<int name="ZIndex">1</int>
						<bool name="AutoLocalize">true</bool>
						<Ref name="RootLocalizationTable">null</Ref>
						<token name="SelectionBehaviorDown">0</token>
						<token name="SelectionBehaviorLeft">0</token>
						<token name="SelectionBehaviorRight">0</token>
						<token name="SelectionBehaviorUp">0</token>
						<bool name="SelectionGroup">false</bool>
						<BinaryString name="AttributesSerialize"></BinaryString>
						<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
						<bool name="DefinesCapabilities">false</bool>
						<UniqueId name="HistoryId">6e834dae133f2d660a307b2b00000ac4</UniqueId>
						<string name="Name">body</string>
						<int64 name="SourceAssetId">-1</int64>
						<BinaryString name="Tags"></BinaryString>
						<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000cc7</UniqueId>
					</Properties>
					<Item class="Frame" referent="RBX0471d155fe134cf180ee9f8d4e972e44">
						<Properties>
							<token name="Style">0</token>
							<bool name="Active">false</bool>
							<Vector2 name="AnchorPoint">
								<X>0</X>
								<Y>0</Y>
							</Vector2>
							<token name="AutomaticSize">0</token>
							<Color3 name="BackgroundColor3">
								<R>1</R>
								<G>1</G>
								<B>1</B>
							</Color3>
							<float name="BackgroundTransparency">1</float>
							<Color3 name="BorderColor3">
								<R>0</R>
								<G>0</G>
								<B>0</B>
							</Color3>
							<token name="BorderMode">0</token>
							<int name="BorderSizePixel">0</int>
							<bool name="ClipsDescendants">false</bool>
							<bool name="Draggable">false</bool>
							<token name="InputSink">0</token>
							<bool name="Interactable">true</bool>
							<int name="LayoutOrder">0</int>
							<Ref name="NextSelectionDown">null</Ref>
							<Ref name="NextSelectionLeft">null</Ref>
							<Ref name="NextSelectionRight">null</Ref>
							<Ref name="NextSelectionUp">null</Ref>
							<UDim2 name="Position">
								<XS>0.25</XS>
								<XO>0</XO>
								<YS>0</YS>
								<YO>0</YO>
							</UDim2>
							<float name="Rotation">0</float>
							<bool name="Selectable">false</bool>
							<Ref name="SelectionImageObject">null</Ref>
							<int name="SelectionOrder">0</int>
							<UDim2 name="Size">
								<XS>0.5</XS>
								<XO>0</XO>
								<YS>1</YS>
								<YO>0</YO>
							</UDim2>
							<token name="SizeConstraint">0</token>
							<bool name="Visible">true</bool>
							<int name="ZIndex">1</int>
							<bool name="AutoLocalize">true</bool>
							<Ref name="RootLocalizationTable">null</Ref>
							<token name="SelectionBehaviorDown">0</token>
							<token name="SelectionBehaviorLeft">0</token>
							<token name="SelectionBehaviorRight">0</token>
							<token name="SelectionBehaviorUp">0</token>
							<bool name="SelectionGroup">false</bool>
							<BinaryString name="AttributesSerialize"></BinaryString>
							<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
							<bool name="DefinesCapabilities">false</bool>
							<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
							<string name="Name">container</string>
							<int64 name="SourceAssetId">-1</int64>
							<BinaryString name="Tags"></BinaryString>
							<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000014c6</UniqueId>
						</Properties>
						<Item class="TextLabel" referent="RBXe694de511fce4e33ad819ddb6955654d">
							<Properties>
								<Font name="FontFace">
									<Family><url>rbxasset://fonts/families/SourceSansPro.json</url></Family>
									<Weight>400</Weight>
									<Style>Normal</Style>
									<CachedFaceId><url>rbxasset://fonts/SourceSansPro-Regular.ttf</url></CachedFaceId>
								</Font>
								<float name="LineHeight">1</float>
								<string name="LocalizationMatchIdentifier"></string>
								<string name="LocalizationMatchedSourceText"></string>
								<int name="MaxVisibleGraphemes">-1</int>
								<string name="OpenTypeFeatures"></string>
								<bool name="RichText">false</bool>
								<string name="Text">To get started, press Alt+P, or Command+P (on Mac) to publish this game.</string>
								<Color3 name="TextColor3">
									<R>0</R>
									<G>0</G>
									<B>0</B>
								</Color3>
								<token name="TextDirection">0</token>
								<bool name="TextScaled">true</bool>
								<float name="TextSize">14</float>
								<Color3 name="TextStrokeColor3">
									<R>0</R>
									<G>0</G>
									<B>0</B>
								</Color3>
								<float name="TextStrokeTransparency">1</float>
								<float name="TextTransparency">0</float>
								<token name="TextTruncate">0</token>
								<bool name="TextWrapped">true</bool>
								<token name="TextXAlignment">2</token>
								<token name="TextYAlignment">1</token>
								<bool name="Active">false</bool>
								<Vector2 name="AnchorPoint">
									<X>0</X>
									<Y>0</Y>
								</Vector2>
								<token name="AutomaticSize">0</token>
								<Color3 name="BackgroundColor3">
									<R>1</R>
									<G>1</G>
									<B>1</B>
								</Color3>
								<float name="BackgroundTransparency">1</float>
								<Color3 name="BorderColor3">
									<R>0</R>
									<G>0</G>
									<B>0</B>
								</Color3>
								<token name="BorderMode">0</token>
								<int name="BorderSizePixel">0</int>
								<bool name="ClipsDescendants">false</bool>
								<bool name="Draggable">false</bool>
								<token name="InputSink">0</token>
								<bool name="Interactable">true</bool>
								<int name="LayoutOrder">0</int>
								<Ref name="NextSelectionDown">null</Ref>
								<Ref name="NextSelectionLeft">null</Ref>
								<Ref name="NextSelectionRight">null</Ref>
								<Ref name="NextSelectionUp">null</Ref>
								<UDim2 name="Position">
									<XS>0</XS>
									<XO>0</XO>
									<YS>0.0545454547</YS>
									<YO>0</YO>
								</UDim2>
								<float name="Rotation">0</float>
								<bool name="Selectable">false</bool>
								<Ref name="SelectionImageObject">null</Ref>
								<int name="SelectionOrder">0</int>
								<UDim2 name="Size">
									<XS>1</XS>
									<XO>0</XO>
									<YS>0.156363636</YS>
									<YO>0</YO>
								</UDim2>
								<token name="SizeConstraint">0</token>
								<bool name="Visible">true</bool>
								<int name="ZIndex">1</int>
								<bool name="AutoLocalize">true</bool>
								<Ref name="RootLocalizationTable">null</Ref>
								<token name="SelectionBehaviorDown">0</token>
								<token name="SelectionBehaviorLeft">0</token>
								<token name="SelectionBehaviorRight">0</token>
								<token name="SelectionBehaviorUp">0</token>
								<bool name="SelectionGroup">false</bool>
								<BinaryString name="AttributesSerialize"></BinaryString>
								<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
								<bool name="DefinesCapabilities">false</bool>
								<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
								<string name="Name">TextLabel</string>
								<int64 name="SourceAssetId">-1</int64>
								<BinaryString name="Tags"></BinaryString>
								<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00001628</UniqueId>
							</Properties>
						</Item>
					</Item>
				</Item>
			</Item>
			<Item class="LocalScript" referent="RBX470d527de6094c2cb12d4fb64b90c2b3">
				<Properties>
					<ProtectedString name="Source">script.Parent:Remove();</ProtectedString>
					<bool name="Disabled">false</bool>
					<Content name="LinkedSource"><null></null></Content>
					<token name="RunContext">0</token>
					<string name="ScriptGuid">{c853aac6-b8a1-4536-a4cc-37a9d4e2e83f}</string>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">LocalScript</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000017cd</UniqueId>
				</Properties>
			</Item>
		</Item>
	</Item>
	<Item class="LocalizationService" referent="RBX89ef1924fd14469ea1a7690e76fc3b18">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">LocalizationService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000361</UniqueId>
		</Properties>
	</Item>
	<Item class="TeleportService" referent="RBXd75c39b40b984147a9a9f7e299993442">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Teleport Service</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000365</UniqueId>
		</Properties>
	</Item>
	<Item class="PhysicsService" referent="RBXdf8084d6367b474e8fe6734a039b305d">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">PhysicsService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000367</UniqueId>
		</Properties>
	</Item>
	<Item class="InsertService" referent="RBXfdfcf98b6f284e1bb63a6a68a0f2e69c">
		<Properties>
			<bool name="AllowClientInsertModels">false</bool>
			<bool name="AllowInsertFreeModels">false</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">InsertService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000036a</UniqueId>
		</Properties>
		<Item class="StringValue" referent="RBX258891f48fcb407c9fe1781fd9d4e061">
			<Properties>
				<string name="Value">{2101ca5b-cc88-4177-a9a2-6427fa7b06a6}</string>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">InsertionHash</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003bf</UniqueId>
			</Properties>
		</Item>
	</Item>
	<Item class="GamePassService" referent="RBXab251b8aee8c4fb8b6e0f999a0f6fc6d">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">GamePassService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000036b</UniqueId>
		</Properties>
	</Item>
	<Item class="Debris" referent="RBX69db95333c52411882cddee67d8c5fe8">
		<Properties>
			<int name="MaxItems">1000</int>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Debris</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000036c</UniqueId>
		</Properties>
	</Item>
	<Item class="CookiesService" referent="RBXa13b194dae9d4fa1af0f489cf9a318c4">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">CookiesService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000036d</UniqueId>
		</Properties>
	</Item>
	<Item class="Selection" referent="RBXff11904f56c34befa0fad528f594ec2a">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Selection</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000036e</UniqueId>
		</Properties>
	</Item>
	<Item class="VRService" referent="RBX2d2420a671a5416aa33f887dfe11c278">
		<Properties>
			<token name="AutomaticScaling">0</token>
			<bool name="AvatarGestures">false</bool>
			<token name="ControllerModels">1</token>
			<bool name="FadeOutViewOnCollision">true</bool>
			<token name="LaserPointer">1</token>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">VRService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000372</UniqueId>
		</Properties>
	</Item>
	<Item class="ContextActionService" referent="RBXd26b8433111d4e9280a068d4a7c7cf30">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ContextActionService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000373</UniqueId>
		</Properties>
	</Item>
	<Item class="ScriptService" referent="RBX069647c29a424a238becee7338437b3e">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Instance</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000374</UniqueId>
		</Properties>
	</Item>
	<Item class="AssetService" referent="RBXb5f0910f455c4815975d0426a633d3f1">
		<Properties>
			<bool name="AllowInsertFreeAssets">false</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">AssetService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000375</UniqueId>
		</Properties>
	</Item>
	<Item class="TouchInputService" referent="RBXab179aa824184581abb244928279c15e">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">TouchInputService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000377</UniqueId>
		</Properties>
	</Item>
	<Item class="AvatarSettings" referent="RBX971083e18a9645f79954f023865d793b">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">AvatarSettings</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000037d</UniqueId>
		</Properties>
		<Item class="AvatarRules" referent="RBX54640d83702e408cb5f738dd98be1841">
			<Properties>
				<token name="AvatarType">1</token>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">DefaultAvatarRules</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">67e1db2b00eda3070a307e83000003bc</UniqueId>
			</Properties>
			<Item class="AvatarBodyRules" referent="RBX3cd988917fd64313a1a89b9340461370">
				<Properties>
					<token name="AppearanceMode">0</token>
					<token name="BuildMode">0</token>
					<int64 name="CustomBodyBundleId">0</int64>
					<token name="CustomBodyType">0</token>
					<NumberRange name="CustomBodyTypeScale">0 1 </NumberRange>
					<bool name="CustomEyebrowEnabled">false</bool>
					<int64 name="CustomEyebrowId">0</int64>
					<bool name="CustomEyelashEnabled">false</bool>
					<int64 name="CustomEyelashId">0</int64>
					<bool name="CustomFaceEnabled">false</bool>
					<int64 name="CustomFaceId">0</int64>
					<bool name="CustomHeadEnabled">false</bool>
					<int64 name="CustomHeadId">0</int64>
					<NumberRange name="CustomHeadScale">0.95 1 </NumberRange>
					<NumberRange name="CustomHeight">5.5 5.5 </NumberRange>
					<NumberRange name="CustomHeightScale">0.9 1.05 </NumberRange>
					<bool name="CustomLeftArmEnabled">false</bool>
					<int64 name="CustomLeftArmId">0</int64>
					<bool name="CustomLeftLegEnabled">false</bool>
					<int64 name="CustomLeftLegId">0</int64>
					<bool name="CustomMoodEnabled">false</bool>
					<int64 name="CustomMoodId">0</int64>
					<NumberRange name="CustomProportionsScale">0 1 </NumberRange>
					<bool name="CustomRightArmEnabled">false</bool>
					<int64 name="CustomRightArmId">0</int64>
					<bool name="CustomRightLegEnabled">false</bool>
					<int64 name="CustomRightLegId">0</int64>
					<bool name="CustomTorsoEnabled">false</bool>
					<int64 name="CustomTorsoId">0</int64>
					<NumberRange name="CustomWidthScale">0.7 1 </NumberRange>
					<bool name="KeepPlayerHead">true</bool>
					<token name="ScaleMode">0</token>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">AvatarBodyRules</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">67e1db2b00eda3070a307e83000003bd</UniqueId>
				</Properties>
			</Item>
			<Item class="AvatarCollisionRules" referent="RBXc68694bac4f0447992ae6f0dd4f190a3">
				<Properties>
					<token name="CollisionMode">0</token>
					<token name="HitAndTouchDetectionMode">0</token>
					<token name="LegacyCollisionMode">1</token>
					<Vector3 name="SingleColliderSize">
						<X>2</X>
						<Y>3</Y>
						<Z>1</Z>
					</Vector3>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">AvatarCollisionRules</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">67e1db2b00eda3070a307e83000003be</UniqueId>
				</Properties>
			</Item>
			<Item class="AvatarAbilityRules" referent="RBXd2e47a1fa87e4528b824c7d4da8a26ba">
				<Properties>
					<token name="CharacterControllerMode">0</token>
					<bool name="EnableClimbing">true</bool>
					<bool name="EnableCrouching">true</bool>
					<bool name="EnableFallingDown">true</bool>
					<bool name="EnableGettingUp">true</bool>
					<bool name="EnableHolding">true</bool>
					<bool name="EnableJumping">true</bool>
					<bool name="EnableReaching">true</bool>
					<bool name="EnableRunning">true</bool>
					<bool name="EnableSitting">true</bool>
					<bool name="EnableSprinting">true</bool>
					<bool name="EnableStrafing">true</bool>
					<bool name="EnableSwimming">true</bool>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">AvatarAbilityRules</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">67e1db2b00eda3070a307e83000003bf</UniqueId>
				</Properties>
			</Item>
			<Item class="AvatarAnimationRules" referent="RBXb21bb4235d8848ff8244458bb8ab82dd">
				<Properties>
					<token name="AnimationClipsMode">0</token>
					<token name="AnimationPacksMode">0</token>
					<bool name="CustomClimbAnimationEnabled">false</bool>
					<int64 name="CustomClimbAnimationId">0</int64>
					<bool name="CustomFallAnimationEnabled">false</bool>
					<int64 name="CustomFallAnimationId">0</int64>
					<bool name="CustomIdleAlt1AnimationEnabled">false</bool>
					<int64 name="CustomIdleAlt1AnimationId">0</int64>
					<bool name="CustomIdleAlt2AnimationEnabled">false</bool>
					<int64 name="CustomIdleAlt2AnimationId">0</int64>
					<bool name="CustomIdleAnimationEnabled">false</bool>
					<int64 name="CustomIdleAnimationId">0</int64>
					<bool name="CustomJumpAnimationEnabled">false</bool>
					<int64 name="CustomJumpAnimationId">0</int64>
					<bool name="CustomRunAnimationEnabled">false</bool>
					<int64 name="CustomRunAnimationId">0</int64>
					<bool name="CustomSwimAnimationEnabled">false</bool>
					<int64 name="CustomSwimAnimationId">0</int64>
					<bool name="CustomSwimIdleAnimationEnabled">false</bool>
					<int64 name="CustomSwimIdleAnimationId">0</int64>
					<bool name="CustomWalkAnimationEnabled">false</bool>
					<int64 name="CustomWalkAnimationId">0</int64>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">AvatarAnimationRules</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">67e1db2b00eda3070a307e83000003c0</UniqueId>
				</Properties>
			</Item>
			<Item class="AvatarAccessoryRules" referent="RBX41c614cd4a274342a48f3c803ca73ded">
				<Properties>
					<token name="AccessoryMode">0</token>
					<token name="CustomAccessoryMode">0</token>
					<bool name="CustomBackAccessoryEnabled">false</bool>
					<int64 name="CustomBackAccessoryId">0</int64>
					<bool name="CustomFaceAccessoryEnabled">false</bool>
					<int64 name="CustomFaceAccessoryId">0</int64>
					<bool name="CustomFrontAccessoryEnabled">false</bool>
					<int64 name="CustomFrontAccessoryId">0</int64>
					<bool name="CustomHairAccessoryEnabled">false</bool>
					<int64 name="CustomHairAccessoryId">0</int64>
					<bool name="CustomHeadAccessoryEnabled">false</bool>
					<int64 name="CustomHeadAccessoryId">0</int64>
					<bool name="CustomNeckAccessoryEnabled">false</bool>
					<int64 name="CustomNeckAccessoryId">0</int64>
					<bool name="CustomShoulderAccessoryEnabled">false</bool>
					<int64 name="CustomShoulderAccessoryId">0</int64>
					<bool name="CustomWaistAccessoryEnabled">false</bool>
					<int64 name="CustomWaistAccessoryId">0</int64>
					<bool name="EnableSound">true</bool>
					<bool name="EnableVFX">true</bool>
					<Vector3 name="LimitBounds">
						<X>0</X>
						<Y>0</Y>
						<Z>0</Z>
					</Vector3>
					<token name="LimitMethod">1</token>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">AvatarAccessoryRules</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">67e1db2b00eda3070a307e83000003c1</UniqueId>
				</Properties>
			</Item>
			<Item class="AvatarClothingRules" referent="RBX135fc6bc12e040ddb7c7efbdd1bf525f">
				<Properties>
					<token name="ClothingMode">0</token>
					<bool name="CustomClassicPantsAccessoryEnabled">false</bool>
					<int64 name="CustomClassicPantsAccessoryId">0</int64>
					<bool name="CustomClassicShirtsAccessoryEnabled">false</bool>
					<int64 name="CustomClassicShirtsAccessoryId">0</int64>
					<bool name="CustomClassicTShirtsAccessoryEnabled">false</bool>
					<int64 name="CustomClassicTShirtsAccessoryId">0</int64>
					<token name="CustomClothingMode">0</token>
					<bool name="CustomDressSkirtAccessoryEnabled">false</bool>
					<int64 name="CustomDressSkirtAccessoryId">0</int64>
					<bool name="CustomJacketAccessoryEnabled">false</bool>
					<int64 name="CustomJacketAccessoryId">0</int64>
					<bool name="CustomLeftShoesAccessoryEnabled">false</bool>
					<int64 name="CustomLeftShoesAccessoryId">0</int64>
					<bool name="CustomPantsAccessoryEnabled">false</bool>
					<int64 name="CustomPantsAccessoryId">0</int64>
					<bool name="CustomRightShoesAccessoryEnabled">false</bool>
					<int64 name="CustomRightShoesAccessoryId">0</int64>
					<bool name="CustomShirtAccessoryEnabled">false</bool>
					<int64 name="CustomShirtAccessoryId">0</int64>
					<bool name="CustomShortsAccessoryEnabled">false</bool>
					<int64 name="CustomShortsAccessoryId">0</int64>
					<bool name="CustomSweaterAccessoryEnabled">false</bool>
					<int64 name="CustomSweaterAccessoryId">0</int64>
					<bool name="CustomTShirtAccessoryEnabled">false</bool>
					<int64 name="CustomTShirtAccessoryId">0</int64>
					<Vector3 name="LimitBounds">
						<X>0</X>
						<Y>0</Y>
						<Z>0</Z>
					</Vector3>
					<BinaryString name="AttributesSerialize"></BinaryString>
					<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
					<bool name="DefinesCapabilities">false</bool>
					<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
					<string name="Name">AvatarClothingRules</string>
					<int64 name="SourceAssetId">-1</int64>
					<BinaryString name="Tags"></BinaryString>
					<UniqueId name="UniqueId">67e1db2b00eda3070a307e83000003c2</UniqueId>
				</Properties>
			</Item>
		</Item>
	</Item>
	<Item class="Packages" referent="RBX0b9f79c473214977833e643828a4b4af">
		<Properties>
			<bool name="IsDehydrated">false</bool>
			<int name="ShellPackagesCount">0</int>
			<int name="SkippedInstancesCount">0</int>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Packages</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000381</UniqueId>
		</Properties>
	</Item>
	<Item class="GuidRegistryService" referent="RBX752da253c4a94c0eaea6100f80a713a6">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">GuidRegistryService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000382</UniqueId>
		</Properties>
	</Item>
	<Item class="ServiceVisibilityService" referent="RBX1fd2489d482f4ee9965e8ebe7fdb784c">
		<Properties>
			<BinaryString name="HiddenServices">AAAAAA==</BinaryString>
			<BinaryString name="VisibleServices">AAAAAA==</BinaryString>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ServiceVisibilityService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000039e</UniqueId>
		</Properties>
	</Item>
	<Item class="LuaWebService" referent="RBXfa21a69520b3441ba3f87f134f3bf830">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">LuaWebService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000389</UniqueId>
		</Properties>
	</Item>
	<Item class="ProcessInstancePhysicsService" referent="RBX54a854c5cb1145969632a34c2d8b7fe2">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ProcessInstancePhysicsService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000038a</UniqueId>
		</Properties>
	</Item>
	<Item class="ReplicatedStorage" referent="RBX4619cb177f7b4c9dac592b50a0ae05ba">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ReplicatedStorage</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000038b</UniqueId>
		</Properties>
	</Item>
	<Item class="ServerScriptService" referent="RBXc3ddf438221b469eb30b4199e342f68b">
		<Properties>
			<bool name="LoadStringEnabled">false</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ServerScriptService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000038c</UniqueId>
		</Properties>
		<Item class="Script" referent="RBX306cb8cda3ac49c3a17d022dfc811fc1">
			<Properties>
				<ProtectedString name="Source"><![CDATA[--[[
 /$$$$$$$             /$$$$$$        /$$               /$$          
| $$__  $$           /$$__  $$      | $$              |__/          
| $$  \ $$  /$$$$$$ | $$  \ $$  /$$$$$$$ /$$$$$$/$$$$  /$$ /$$$$$$$ 
| $$$$$$$/ /$$__  $$| $$$$$$$$ /$$__  $$| $$_  $$_  $$| $$| $$__  $$
| $$__  $$| $$$$$$$$| $$__  $$| $$  | $$| $$ \ $$ \ $$| $$| $$  \ $$
| $$  \ $$| $$_____/| $$  | $$| $$  | $$| $$ | $$ | $$| $$| $$  | $$
| $$  | $$|  $$$$$$$| $$  | $$|  $$$$$$$| $$ | $$ | $$| $$| $$  | $$
|__/  |__/ \_______/|__/  |__/ \_______/|__/ |__/ |__/|__/|__/  |__/
                                                                    
                                                                    
Application Center

All you need to do is publish your game, do not mess with this script unless you know what you're doing.

This code is provided as is, and proivdes no warranties. ReAdmin does not carry any liability in accordiance to the use of this code.
All rights reserved, ReAdmin 2026
]]

require(90428048416593)({ -- Do not mess with these lines unless you know what you're doing.
	loaderId = "${workspace.loaderId}" -- Do not mess with this line unless you know what you're doing.
});]]></ProtectedString>
				<bool name="Disabled">false</bool>
				<Content name="LinkedSource"><null></null></Content>
				<token name="RunContext">0</token>
				<string name="ScriptGuid">{7ea312c4-ac8f-4c89-8f12-47126f972eb5}</string>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">23ce3f8f16b8344a06f295f0000055be</UniqueId>
				<string name="Name">AC-LOAD</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000017d1</UniqueId>
			</Properties>
		</Item>
	</Item>
	<Item class="ServerStorage" referent="RBXae9681f60de5475b91913ca0b40a1975">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ServerStorage</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b0000038d</UniqueId>
		</Properties>
	</Item>
	<Item class="HttpService" referent="RBXe625bf4e11bd46ed8bcace61fb197972">
		<Properties>
			<bool name="HttpEnabled">true</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">HttpService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003a1</UniqueId>
		</Properties>
	</Item>
	<Item class="DataStoreService" referent="RBXbfc843053f1341229122508df8c9a633">
		<Properties>
			<bool name="AutomaticRetry">true</bool>
			<bool name="LegacyNamingScheme">false</bool>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">DataStoreService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003ad</UniqueId>
		</Properties>
	</Item>
	<Item class="Lighting" referent="RBXbbd1e3252d564cd8a13730a1cfda6564">
		<Properties>
			<Color3 name="Ambient">
				<R>0.274509817</R>
				<G>0.274509817</G>
				<B>0.274509817</B>
			</Color3>
			<float name="Brightness">3</float>
			<Color3 name="ColorShift_Bottom">
				<R>0</R>
				<G>0</G>
				<B>0</B>
			</Color3>
			<Color3 name="ColorShift_Top">
				<R>0</R>
				<G>0</G>
				<B>0</B>
			</Color3>
			<float name="EnvironmentDiffuseScale">1</float>
			<float name="EnvironmentSpecularScale">1</float>
			<float name="ExposureCompensation">0</float>
			<token name="ExtendLightRangeTo120">0</token>
			<Color3 name="FogColor">
				<R>0.752941251</R>
				<G>0.752941251</G>
				<B>0.752941251</B>
			</Color3>
			<float name="FogEnd">100000</float>
			<float name="FogStart">0</float>
			<float name="GeographicLatitude">0</float>
			<bool name="GlobalShadows">true</bool>
			<token name="LightingStyle">1</token>
			<Color3 name="OutdoorAmbient">
				<R>0.274509817</R>
				<G>0.274509817</G>
				<B>0.274509817</B>
			</Color3>
			<bool name="Outlines">false</bool>
			<bool name="PrioritizeLightingQuality">true</bool>
			<float name="ShadowSoftness">0.200000003</float>
			<token name="Technology">3</token>
			<string name="TimeOfDay">14:30:00</string>
			<BinaryString name="AttributesSerialize"><![CDATA[AgAAACYAAABSQlhfTGlnaHRpbmdUZWNobm9sb2d5VW5pZmllZE1pZ3JhdGlvbgMBIAAAAFJC
WF9PcmlnaW5hbFRlY2hub2xvZ3lPbkZpbGVMb2FkBAMAAAA=]]></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Lighting</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003ae</UniqueId>
		</Properties>
		<Item class="Sky" referent="RBXe14db7d44abd4bb88e61354926c5d480">
			<Properties>
				<bool name="CelestialBodiesShown">true</bool>
				<float name="MoonAngularSize">11</float>
				<Content name="MoonTextureId"><url>rbxassetid://6444320592</url></Content>
				<Content name="SkyboxBk"><url>rbxassetid://6444884337</url></Content>
				<Content name="SkyboxDn"><url>rbxassetid://6444884785</url></Content>
				<Content name="SkyboxFt"><url>rbxassetid://6444884337</url></Content>
				<Content name="SkyboxLf"><url>rbxassetid://6444884337</url></Content>
				<Vector3 name="SkyboxOrientation">
					<X>0</X>
					<Y>0</Y>
					<Z>0</Z>
				</Vector3>
				<Content name="SkyboxRt"><url>rbxassetid://6444884337</url></Content>
				<Content name="SkyboxUp"><url>rbxassetid://6412503613</url></Content>
				<int name="StarCount">3000</int>
				<float name="SunAngularSize">11</float>
				<Content name="SunTextureId"><url>rbxassetid://6196665106</url></Content>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">Sky</string>
				<int64 name="SourceAssetId">332039975</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c0</UniqueId>
			</Properties>
		</Item>
		<Item class="SunRaysEffect" referent="RBX8478cbb90b264815b6286ae184394295">
			<Properties>
				<float name="Intensity">0.00999999978</float>
				<float name="Spread">0.100000001</float>
				<bool name="Enabled">true</bool>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">SunRays</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c1</UniqueId>
			</Properties>
		</Item>
		<Item class="Atmosphere" referent="RBXc0126386eb5c4b858290e0b9b70b4c28">
			<Properties>
				<Color3 name="Color">
					<R>0.78039217</R>
					<G>0.78039217</G>
					<B>0.78039217</B>
				</Color3>
				<Color3 name="Decay">
					<R>0.41568628</R>
					<G>0.43921569</G>
					<B>0.490196079</B>
				</Color3>
				<float name="Density">0.300000012</float>
				<float name="Glare">0</float>
				<float name="Haze">0</float>
				<float name="Offset">0.25</float>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">Atmosphere</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c2</UniqueId>
			</Properties>
		</Item>
		<Item class="BloomEffect" referent="RBXca41e94a0a8c4094bc57c8f382954107">
			<Properties>
				<float name="Intensity">1</float>
				<float name="Size">24</float>
				<float name="Threshold">2</float>
				<bool name="Enabled">true</bool>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">Bloom</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c3</UniqueId>
			</Properties>
		</Item>
		<Item class="DepthOfFieldEffect" referent="RBX446993e8ebe74201b68ed2f02aedf0b0">
			<Properties>
				<float name="FarIntensity">0.100000001</float>
				<float name="FocusDistance">0.0500000007</float>
				<float name="InFocusRadius">30</float>
				<float name="NearIntensity">0.75</float>
				<bool name="Enabled">false</bool>
				<BinaryString name="AttributesSerialize"></BinaryString>
				<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
				<bool name="DefinesCapabilities">false</bool>
				<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
				<string name="Name">DepthOfField</string>
				<int64 name="SourceAssetId">-1</int64>
				<BinaryString name="Tags"></BinaryString>
				<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003c4</UniqueId>
			</Properties>
		</Item>
	</Item>
	<Item class="LodDataService" referent="RBX209a1e0677b3456cb451253988284ecc">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Instance</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003af</UniqueId>
		</Properties>
	</Item>
	<Item class="ProximityPromptService" referent="RBX6d4648f4bdc44df29c1d01b6ac4dc8b9">
		<Properties>
			<bool name="Enabled">true</bool>
			<int name="MaxIndicatorsVisible">16</int>
			<int name="MaxPromptsVisible">16</int>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">ProximityPromptService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b0</UniqueId>
		</Properties>
	</Item>
	<Item class="Teams" referent="RBX6c7892b111424183b7bd91a0fa467b72">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">Teams</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b1</UniqueId>
		</Properties>
	</Item>
	<Item class="TestService" referent="RBXe02c29d0aa60488f8f506d63427ec01a">
		<Properties>
			<bool name="AutoRuns">true</bool>
			<string name="Description"></string>
			<bool name="ExecuteWithStudioRun">false</bool>
			<bool name="IsPhysicsEnvironmentalThrottled">true</bool>
			<bool name="IsSleepAllowed">true</bool>
			<int name="NumberOfPlayers">0</int>
			<double name="SimulateSecondsLag">0</double>
			<bool name="ThrottlePhysicsToRealtime">true</bool>
			<double name="Timeout">10</double>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">TestService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b2</UniqueId>
		</Properties>
	</Item>
	<Item class="UGCAvatarService" referent="RBXf5eef8cde12f4d879c52e4f3930c688c">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">UGCAvatarService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b3</UniqueId>
		</Properties>
	</Item>
	<Item class="VideoService" referent="RBX1d3219e528194676962c1055330d7836">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">VideoService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b00000619</UniqueId>
		</Properties>
	</Item>
	<Item class="VirtualInputManager" referent="RBXeabc91bad2504ffc892dd33a9c42937c">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">VirtualInputManager</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b4</UniqueId>
		</Properties>
	</Item>
	<Item class="VoiceChatService" referent="RBX40ca15a8d60742ba86237140513418b9">
		<Properties>
			<token name="DefaultDistanceAttenuation">0</token>
			<bool name="EnableDefaultVoice">true</bool>
			<token name="UseAudioApi">2</token>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<SecurityCapabilities name="Capabilities">0</SecurityCapabilities>
			<bool name="DefinesCapabilities">false</bool>
			<UniqueId name="HistoryId">00000000000000000000000000000000</UniqueId>
			<string name="Name">VoiceChatService</string>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
			<UniqueId name="UniqueId">6e834dae133f2d660a307b2b000003b5</UniqueId>
		</Properties>
	</Item>
	<SharedStrings>
		<SharedString md5="yuZpQdnvvUBOTYh1jqZ2cA=="></SharedString>
	</SharedStrings>
</roblox>`;

    const blob = new Blob([appCenter], { type: 'text/rbxlx' });
    //@ts-expect-error gay
    if (window.navigator?.msSaveOrOpenBlob) {
      //@ts-expect-error gay
      window.navigator?.msSaveBlob(blob, `ReAdminApplicationCenter.rbxlx`);
    }
    else {
      const elem = window.document.createElement('a');
      elem.href = window.URL.createObjectURL(blob);
      elem.download = `ReAdminApplicationCenter.rbxlx`;
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
    }

  }

  function downloadActivityTracking() {
    const loader = `<roblox xmlns:xmime="http://www.w3.org/2005/05/xmlmime" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="http://www.roblox.com/roblox.xsd" version="4">
	<Meta name="ExplicitAutoJoints">true</Meta>
	<External>null</External>
	<External>nil</External>
	<Item class="Script" referent="RBXF3A9222D91B04F699936D939AE5D33CB">
		<Properties>
			<BinaryString name="AttributesSerialize"></BinaryString>
			<bool name="Disabled">false</bool>
			<Content name="LinkedSource"><null></null></Content>
			<string name="Name">ReAdminActivityTracker</string>
			<token name="RunContext">0</token>
			<string name="ScriptGuid">{8BCBFB9E-EE28-41BD-A89E-E07A4EDC0487}</string>
			<ProtectedString name="Source"><![CDATA[--[[
	/$$$$$$$             /$$$$$$        /$$               /$$
	| $$__  $$           /$$__  $$      | $$              |__/
	| $$  \ $$  /$$$$$$ | $$  \ $$  /$$$$$$$ /$$$$$$/$$$$  /$$ /$$$$$$$
	| $$$$$$$/ /$$__  $$| $$$$$$$$ /$$__  $$| $$_  $$_  $$| $$| $$__  $$
	| $$__  $$| $$$$$$$$| $$__  $$| $$  | $$| $$ \ $$ \ $$| $$| $$  \ $$
	| $$  \ $$| $$_____/| $$  | $$| $$  | $$| $$ | $$ | $$| $$| $$  | $$
	| $$  | $$|  $$$$$$$| $$  | $$|  $$$$$$$| $$ | $$ | $$| $$| $$  | $$
	|__/  |__/ \_______/|__/  |__/ \_______/|__/ |__/ |__/|__/|__/  |__/

	Activity Tracking Loader
	Written by sloss2003
	Owned by ReAdmin, LLC.
	This code is provided as is, and proivdes no warranties. ReAdmin does not carry any liability in accordiance to the use of this code.
]]

require(13742588012)({ -- Do not mess with this number, it references our loader.
	loaderId = "${workspace.loaderId}", -- Do not mess with this as it is how we link your games to your ReAdmin workspace.
	afkTime = 45, -- These you can change
	loggingEnabled = false,
	hideAFKNotifications = true -- This shows for all users, we suggest keeping it disabled.
})]]></ProtectedString>
			<int64 name="SourceAssetId">-1</int64>
			<BinaryString name="Tags"></BinaryString>
		</Properties>
	</Item>
</roblox>`;


    const blob = new Blob([loader], { type: 'text/rbxmx' });
    //@ts-expect-error gay
    if (window.navigator?.msSaveOrOpenBlob) {
      //@ts-expect-error gay
      window.navigator?.msSaveBlob(blob, `ReAdminActivityTracker.rbxmx`);
    }
    else {
      const elem = window.document.createElement('a');
      elem.href = window.URL.createObjectURL(blob);
      elem.download = `ReAdminActivityTracker.rbxmx`;
      document.body.appendChild(elem);
      elem.click();
      document.body.removeChild(elem);
    }
  }

  if (!workspace?.premium?.is) {
    return (
      <>
        <PageHeading
          title={`${workspace?.groupName} Downloads`}
        />
        <div className='flex flex-col items-center gap-4 mt-6'>
          <h2 className='text-xl font-semibold text-center text-gray-900 dark:text-gray-100'>Only premium workspaces can track in-game activity</h2>
          <p className='text-sm text-gray-500 text-center max-w-md'>Upgrade to premium to unlock activity tracking, in-game monitoring, and more.</p>
          <img src="https://cdn.readmin.app/readmin-public/InGameImage.png" className='max-h-[400px] rounded-xl shadow-lg border border-gray-200 dark:border-gray-700' alt="activity tracking preview" />
          <WorkspaceUpsale />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeading
        title={`${workspace?.groupName} Downloads`}
        description="Download and configure the ReAdmin module for your Roblox games"
      />

      <div className="flex flex-col gap-6 mt-4">
        {/* Guided setup */}
        <Card>
          <Header>Set up activity tracking</Header>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Follow these steps to start tracking staff activity and unlock live
            remote admin in your Roblox game. It takes about 5 minutes.
          </p>

          <ol className="mt-6 flex flex-col gap-5">
            {[
              {
                title: 'Download the activity tracker',
                body: (
                  <>
                    Click <span className="font-medium">Download Activity Tracking Module</span> below.
                    You&apos;ll get a <code className="rounded bg-gray-100 dark:bg-gray-900 px-1 py-0.5 text-xs">ReAdminActivityTracker.rbxmx</code> file
                    that already has your workspace&apos;s loader ID baked in.
                  </>
                ),
              },
              {
                title: 'Open your game in Roblox Studio',
                body: (
                  <>
                    Open the experience you want to track. In the Explorer panel,
                    find <span className="font-medium">ServerScriptService</span>.
                  </>
                ),
              },
              {
                title: 'Insert the module',
                body: (
                  <>
                    Right-click <span className="font-medium">ServerScriptService</span> →{' '}
                    <span className="font-medium">Insert from File…</span> and select the
                    <code className="rounded bg-gray-100 dark:bg-gray-900 px-1 py-0.5 text-xs"> .rbxmx</code> you
                    just downloaded. The <span className="font-medium">ReAdminActivityTracker</span> script will appear inside it.
                  </>
                ),
              },
              {
                title: 'Allow HTTP requests',
                body: (
                  <>
                    Go to <span className="font-medium">Game Settings → Security</span> and turn on{' '}
                    <span className="font-medium">Allow HTTP Requests</span> so the module can talk to ReAdmin.
                  </>
                ),
              },
              {
                title: 'Publish your game',
                body: (
                  <>
                    Hit <span className="font-medium">File → Publish to Roblox</span>. Tracking only runs in the
                    live game, not in Studio test mode.
                  </>
                ),
              },
              {
                title: 'Join and confirm',
                body: (
                  <>
                    Join your live game for a minute, then check your activity in ReAdmin — you should see your
                    session appear. That&apos;s it, you&apos;re tracking! 🎉
                  </>
                ),
              },
            ].map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/40 text-sm font-semibold text-blue-600 dark:text-blue-300">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{step.title}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <Button variant="primary" size="medium" icon={ArrowDownTrayIcon} onClick={downloadActivityTracking}>
              Download Activity Tracking Module
            </Button>
            <Link
              className="inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-gray-800"
              target="_blank"
              href="https://docs.readmin.app/settings/downloads"
            >
              Read the full guide
            </Link>
          </div>

          <div className="mt-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3">
            <p className="text-xs text-blue-800 dark:text-blue-300">
              Stuck on setup? Pop into our{' '}
              <Link className="font-semibold underline" target="_blank" href="https://discord.gg/msdjzQNsV2">
                support server
              </Link>{' '}
              and we&apos;ll happily point you in the right direction. Want us to
              do it all for you? Add our{' '}
              <Link className="font-semibold underline" href={`/workspaces/${groupId}/settings/billing`}>
                done-for-you setup
              </Link>{' '}
              at checkout.
            </p>
          </div>
        </Card>

        {/* How it works */}
        <Card>
          <Header>How activity tracking works</Header>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">1. The module runs server-side</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Once published, the ReAdminActivityTracker script runs in your game and watches each player&apos;s session — the time they&apos;re active, idle, typing, and the messages they send.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">2. Sessions sync to ReAdmin</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Using your loader ID, the module securely sends those sessions to ReAdmin over HTTPS. Your loader ID is what links a game to <span className="font-medium">this</span> workspace.
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">3. You build Views &amp; rank</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                That activity feeds Views, activity goals, remote admin, and ranking — so you can see who&apos;s active and act on it from the dashboard or Discord.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
            Activity only records in your <span className="font-medium">published, live game</span> — not while testing in Studio. AFK and alt-tab time is detected automatically so tracked time reflects real activity.
          </p>
        </Card>

        {/* Loader ID */}
        <Card>
          <Header>Loader ID</Header>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Your unique identifier that links games to your workspace. It&apos;s already included in the module you download — you only need this if you&apos;re setting things up by hand or using the API.</p>
          
          <div className='flex flex-col sm:flex-row items-start sm:items-center gap-3'>
            <div className='flex-1 w-full'>
              <div className='font-mono text-xs break-all bg-gray-100 dark:bg-gray-900 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 cursor-pointer' onClick={() => setShowingLoaderId(!showingLoaderId)}>
                {showingLoaderId ? workspace.loaderId : '\u2022'.repeat(48)}
              </div>
            </div>
            <div className='flex flex-row gap-2 shrink-0'>
              <Button size="small" icon={showingLoaderId ? EyeSlashIcon : EyeIcon} variant="discrete" onClick={() => setShowingLoaderId(!showingLoaderId)} />
              <Button size="small" icon={ClipboardIcon} variant="blue" onClick={() => {
                navigator.clipboard.writeText(workspace.loaderId)
                toast.success('Copied Loader ID to clipboard')
              }}>Copy</Button>
              <Button size="small" icon={ArrowPathIcon} variant="danger" onClick={resetLoaderId}>Reset</Button>
            </div>
          </div>
          
          <div className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className='text-xs text-amber-800 dark:text-amber-300'>
              Resetting your loader ID requires you to re-install the module <span className="font-semibold">in all games you wish to track</span> with the new ID.
            </p>
          </div>
        </Card>

        {/* Application Center — embed in the activity tracker */}
        <Card>
          <Header>In-Game Application Center</Header>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Let players open your application center as a window inside your game — no separate place needed. When enabled, the activity tracker adds an
            {' '}<span className="font-medium">Applications</span> button to the in-game ReAdmin menu. Applications still flow into Forms exactly as they do standalone.
          </p>
          <div className="mt-4">
            <Toggle
              title="Enable in your game"
              description="Loads the Application Center as an optional, on-demand window inside the activity tracker. Movement and the rest of your game stay fully playable."
              value={appCenterSettings?.enabled || false}
              onChange={(enabled) => saveApplicationCenter({ enabled })}
            />
          </div>

          {appCenterSettings?.enabled && (
            <div className="mt-4 space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display mode</label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">How the panel appears when a player opens it.</p>
                <select
                  value={appCenterSettings?.displayMode || 'windowed'}
                  onChange={(e) => saveApplicationCenter({ displayMode: e.target.value as 'windowed' | 'fullscreen' })}
                  className="block w-full max-w-xs rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="windowed">Windowed — floats over your game</option>
                  <option value="fullscreen">Fullscreen — fills the screen</option>
                </select>
              </div>
              <Toggle
                title="Dim the game behind it"
                description="Darkens and blocks the game behind the window while the Application Center is open."
                value={appCenterSettings?.backdrop || false}
                onChange={(backdrop) => saveApplicationCenter({ backdrop })}
              />
            </div>
          )}
        </Card>

        {/* Application Center — standalone place-file template */}
        <Card>
          <Header>Application Center Game Template</Header>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            An optional place-file template for running your application center in-game. Download it, then open it in Roblox Studio to publish your own application experience.
          </p>
          <Button variant="primary" size="medium" icon={ArrowDownTrayIcon} onClick={downloadApplicationCenter} className='mt-4'>
            Download Application Center
          </Button>
        </Card>
      </div>
    </>
  );
}

DashboardPage.getLayout = (page: ReactElement) => (
  <SettingsLayout disablePadding={false}>{page}</SettingsLayout>
);
